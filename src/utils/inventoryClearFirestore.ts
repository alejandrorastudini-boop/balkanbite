import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getScopedDocumentId } from "./cloudCollectionSync";

export interface ClearPantryStockExpectation {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
}

export interface ClearPantryRequest {
  userId: string;
  mutationId: string;
  expectedStock: readonly ClearPantryStockExpectation[];
}

export type ClearPantryResult =
  | {
      outcome: "recorded" | "already-recorded";
      mutationId: string;
      clearedItemIds: string[];
    }
  | { outcome: "already-empty"; mutationId: string; clearedItemIds: [] }
  | {
      outcome: "needs-review";
      reason:
        | "invalid-request"
        | "missing-stock"
        | "invalid-stock"
        | "stale-stock"
        | "conflicting-replay";
      pantryItemId?: string;
    };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const safeMutationId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const safeLogicalId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 300 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

function review(
  reason: Extract<ClearPantryResult, { outcome: "needs-review" }>["reason"],
  pantryItemId?: string,
): ClearPantryResult {
  return {
    outcome: "needs-review",
    reason,
    ...(pantryItemId ? { pantryItemId } : {}),
  };
}

function normalizeRequest(request: ClearPantryRequest): {
  expectedStock: ClearPantryStockExpectation[];
  signature: string;
} | null {
  if (
    !safeUid(request?.userId) ||
    !safeMutationId(request?.mutationId) ||
    !Array.isArray(request.expectedStock) ||
    request.expectedStock.length > 300
  ) {
    return null;
  }

  const expectedStock = request.expectedStock
    .map(item => ({ ...item }))
    .sort((a, b) => a.pantryItemId.localeCompare(b.pantryItemId));
  const ids = new Set<string>();

  for (const item of expectedStock) {
    if (
      !safeLogicalId(item?.pantryItemId) ||
      ids.has(item.pantryItemId) ||
      !positive(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      !validRevision(item.cookRevision)
    ) {
      return null;
    }
    ids.add(item.pantryItemId);
  }

  return {
    expectedStock,
    signature: JSON.stringify({
      version: 1,
      source: "clear_all",
      expectedStock,
    }),
  };
}

/**
 * Clears the exact server-confirmed pantry the user reviewed.
 *
 * Every affected lot becomes a revisioned tombstone in one transaction.
 * A concurrently added lot that was not in the reviewed baseline is preserved.
 * Replaying the same mutation ID + baseline is idempotent.
 */
export async function persistVerifiedPantryClear(
  db: Firestore,
  request: ClearPantryRequest,
): Promise<ClearPantryResult> {
  const normalized = normalizeRequest(request);
  if (!normalized) return review("invalid-request");

  const { userId, mutationId } = request;
  const { expectedStock, signature } = normalized;

  if (expectedStock.length === 0) {
    return { outcome: "already-empty", mutationId, clearedItemIds: [] };
  }

  const journalRef = doc(
    db,
    "inventoryClears",
    getScopedDocumentId(userId, mutationId),
  );
  const refs = expectedStock.map(expected => ({
    expected,
    ref: doc(
      db,
      "inventory",
      getScopedDocumentId(userId, expected.pantryItemId),
    ),
  }));

  for (let outerAttempt = 0; outerAttempt < 3; outerAttempt++) {
    try {
      return await runTransaction(db, async tx => {
        const prior = await tx.get(journalRef);
        if (prior.exists()) {
          const data = prior.data();
          if (
            data.userId !== userId ||
            data.mutationId !== mutationId ||
            data.source !== "clear_all" ||
            data.requestSignature !== signature ||
            !Array.isArray(data.itemIds)
          ) {
            return review("conflicting-replay");
          }
          return {
            outcome: "already-recorded" as const,
            mutationId,
            clearedItemIds: data.itemIds as string[],
          };
        }

        const remoteRows: Array<{
          ref: (typeof refs)[number]["ref"];
          expected: ClearPantryStockExpectation;
          revision: number;
        }> = [];

        for (const { expected, ref } of refs) {
          const snapshot = await tx.get(ref);
          if (!snapshot.exists()) {
            return review("missing-stock", expected.pantryItemId);
          }
          const data = snapshot.data();
          const revision = data.cookRevision ?? 0;
          if (
            data.userId !== userId ||
            data.id !== expected.pantryItemId ||
            data._deleted === true ||
            !positive(data.quantity) ||
            typeof data.unit !== "string" ||
            !data.unit.trim() ||
            !validRevision(revision)
          ) {
            return review("invalid-stock", expected.pantryItemId);
          }
          if (
            data.quantity !== expected.quantity ||
            data.unit !== expected.unit ||
            revision !== expected.cookRevision
          ) {
            return review("stale-stock", expected.pantryItemId);
          }
          remoteRows.push({ ref, expected, revision });
        }

        for (const row of remoteRows) {
          tx.update(row.ref, {
            quantity: 0,
            cookRevision: row.revision + 1,
            _deleted: true,
            deletedAt: serverTimestamp(),
          });
        }

        const itemIds = expectedStock.map(item => item.pantryItemId);
        tx.set(journalRef, {
          userId,
          mutationId,
          source: "clear_all",
          requestSignature: signature,
          itemIds,
          createdAt: serverTimestamp(),
        });

        return {
          outcome: "recorded" as const,
          mutationId,
          clearedItemIds: itemIds,
        };
      }, { maxAttempts: 5 });
    } catch (error) {
      if (
        (error as { code?: unknown } | null)?.code !== "permission-denied" ||
        outerAttempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("Pantry clear transaction retry exhausted");
}
