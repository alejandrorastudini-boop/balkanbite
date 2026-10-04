import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getScopedDocumentId } from "./cloudCollectionSync";
import type { VerifiedStockExpectation } from "./inventoryAdjustmentFirestore";
import { isSafeInventoryLogicalId } from "./inventoryIdentity";
import { inventoryLotStateMatchesQuantity } from "./inventoryLots";

export type InventoryClearResult =
  | { outcome: "cleared" | "already-cleared"; clearedIds: string[] }
  | { outcome: "needs-review"; reason: "invalid-request" | "stale-stock" | "invalid-stock" };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeMutationId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);
const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const validRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

function normalizeBaseline(
  baseline: readonly VerifiedStockExpectation[],
): VerifiedStockExpectation[] | null {
  // A single Firestore transaction must remain all-or-nothing. Do not silently
  // chunk Clear-All: partial pantry deletion is worse than refusing a huge set.
  if (!Array.isArray(baseline) || baseline.length === 0 || baseline.length > 200) {
    return null;
  }
  const seen = new Set<string>();
  const normalized: VerifiedStockExpectation[] = [];
  for (const row of baseline) {
    if (!row || !isSafeInventoryLogicalId(row.pantryItemId) ||
        seen.has(row.pantryItemId) || !validQuantity(row.quantity) ||
        typeof row.unit !== "string" || !row.unit.trim() ||
        !validRevision(row.cookRevision)) {
      return null;
    }
    seen.add(row.pantryItemId);
    normalized.push({ ...row });
  }
  return normalized.sort((a, b) => a.pantryItemId.localeCompare(b.pantryItemId));
}

export function inventoryClearSignature(
  baseline: readonly VerifiedStockExpectation[],
): string | null {
  const normalized = normalizeBaseline(baseline);
  return normalized ? JSON.stringify({ version: 1, baseline: normalized }) : null;
}

export async function persistInventoryClearAtomically(
  db: Firestore,
  request: {
    userId: string;
    mutationId: string;
    baseline: readonly VerifiedStockExpectation[];
  },
): Promise<InventoryClearResult> {
  const baseline = normalizeBaseline(request.baseline);
  const signature = baseline ? inventoryClearSignature(baseline) : null;
  if (!safeUid(request.userId) || !safeMutationId(request.mutationId) ||
      !baseline || !signature) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }

  const journalRef = doc(
    db,
    "inventoryClearApplications",
    getScopedDocumentId(request.userId, request.mutationId),
  );
  const stockRefs = baseline.map(expected => ({
    expected,
    ref: doc(
      db,
      "inventory",
      getScopedDocumentId(request.userId, expected.pantryItemId),
    ),
  }));

  for (let outerAttempt = 0; outerAttempt < 3; outerAttempt++) {
    try {
      return await runTransaction(db, async tx => {
        const prior = await tx.get(journalRef);
        if (prior.exists()) {
          const data = prior.data();
          if (data.userId !== request.userId ||
              data.mutationId !== request.mutationId ||
              data.requestSignature !== signature ||
              !Array.isArray(data.clearedIds)) {
            return { outcome: "needs-review" as const, reason: "invalid-request" as const };
          }
          return {
            outcome: "already-cleared" as const,
            clearedIds: [...data.clearedIds] as string[],
          };
        }

        const snapshots = [];
        for (const entry of stockRefs) {
          snapshots.push({ ...entry, snapshot: await tx.get(entry.ref) });
        }

        for (const { expected, snapshot } of snapshots) {
          if (!snapshot.exists()) {
            return { outcome: "needs-review" as const, reason: "stale-stock" as const };
          }
          const data = snapshot.data();
          const revision = data.cookRevision ?? 0;
          if (data.userId !== request.userId ||
              data.id !== expected.pantryItemId ||
              data._deleted === true ||
              !validQuantity(data.quantity) ||
              typeof data.unit !== "string" || !data.unit.trim() ||
              !validRevision(revision) ||
              (data.lotState !== undefined &&
                !inventoryLotStateMatchesQuantity(data.quantity, data.unit, data.lotState))) {
            return { outcome: "needs-review" as const, reason: "invalid-stock" as const };
          }
          if (data.quantity !== expected.quantity ||
              data.unit !== expected.unit ||
              revision !== expected.cookRevision) {
            return { outcome: "needs-review" as const, reason: "stale-stock" as const };
          }
        }

        for (const { expected, ref } of stockRefs) {
          tx.update(ref, {
            quantity: 0,
            lotState: { unallocatedQuantity: 0, activeLots: [] },
            cookRevision: expected.cookRevision + 1,
            _deleted: true,
            deletedAt: serverTimestamp(),
          });
        }
        const clearedIds = baseline.map(row => row.pantryItemId);
        tx.set(journalRef, {
          userId: request.userId,
          mutationId: request.mutationId,
          requestSignature: signature,
          clearedIds,
          createdAt: serverTimestamp(),
        });
        return { outcome: "cleared" as const, clearedIds };
      }, { maxAttempts: 5 });
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code !== "permission-denied" ||
          outerAttempt === 2) throw error;
    }
  }
  throw new Error("Inventory clear transaction retry exhausted");
}
