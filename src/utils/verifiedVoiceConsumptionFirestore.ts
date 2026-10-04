import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getScopedDocumentId } from "./cloudCollectionSync";
import { isSafeInventoryLogicalId } from "./inventoryIdentity";

export interface VerifiedVoiceStockExpectation {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
}

export interface VerifiedVoiceDeduction {
  ingredientName: string;
  pantryItemId: string;
  consumedQuantity: number;
  unit: string;
}

export interface VerifiedVoiceConsumptionRequest {
  userId: string;
  mutationId: string;
  expectedStock: readonly VerifiedVoiceStockExpectation[];
  deductions: readonly VerifiedVoiceDeduction[];
}

export type VerifiedVoiceConsumptionResult =
  | {
      outcome: "recorded" | "already-recorded";
      mutationId: string;
      deductions: VerifiedVoiceDeduction[];
    }
  | {
      outcome: "needs-review";
      reason:
        | "invalid-request"
        | "missing-stock"
        | "invalid-stock"
        | "stale-stock"
        | "incompatible-unit"
        | "insufficient-quantity"
        | "conflicting-replay";
      pantryItemId?: string;
    };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const safeMutationId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

const roundQuantity = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

function review(
  reason: Extract<VerifiedVoiceConsumptionResult, { outcome: "needs-review" }>["reason"],
  pantryItemId?: string,
): VerifiedVoiceConsumptionResult {
  return {
    outcome: "needs-review",
    reason,
    ...(pantryItemId ? { pantryItemId } : {}),
  };
}

function normalizeRequest(
  request: VerifiedVoiceConsumptionRequest,
): {
  expectations: VerifiedVoiceStockExpectation[];
  deductions: VerifiedVoiceDeduction[];
  signature: string;
} | null {
  if (
    !safeUid(request?.userId) ||
    !safeMutationId(request?.mutationId) ||
    !Array.isArray(request.expectedStock) ||
    request.expectedStock.length === 0 ||
    request.expectedStock.length > 30 ||
    !Array.isArray(request.deductions) ||
    request.deductions.length === 0 ||
    request.deductions.length > 60
  ) {
    return null;
  }

  const expectations = request.expectedStock.map(item => ({ ...item }));
  const expectationIds = new Set<string>();
  for (const item of expectations) {
    if (
      !isSafeInventoryLogicalId(item?.pantryItemId) ||
      expectationIds.has(item.pantryItemId) ||
      !positive(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      !validRevision(item.cookRevision)
    ) {
      return null;
    }
    expectationIds.add(item.pantryItemId);
  }

  const deductions = request.deductions.map(item => ({ ...item }));
  for (const item of deductions) {
    if (
      typeof item?.ingredientName !== "string" ||
      !item.ingredientName.trim() ||
      !isSafeInventoryLogicalId(item.pantryItemId) ||
      !expectationIds.has(item.pantryItemId) ||
      !positive(item.consumedQuantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim()
    ) {
      return null;
    }
  }

  expectations.sort((a, b) => a.pantryItemId.localeCompare(b.pantryItemId));
  deductions.sort((a, b) =>
    a.pantryItemId.localeCompare(b.pantryItemId) ||
    a.ingredientName.localeCompare(b.ingredientName) ||
    a.unit.localeCompare(b.unit) ||
    a.consumedQuantity - b.consumedQuantity
  );

  const signature = JSON.stringify({
    version: 1,
    source: "voice",
    expectedStock: expectations,
    deductions,
  });

  return { expectations, deductions, signature };
}

/**
 * Deterministic replay identity for one reviewed voice deduction.
 * This is not a cryptographic signature and not proof of stock provenance.
 */
export function voiceConsumptionSignature(
  request: VerifiedVoiceConsumptionRequest,
): string | null {
  return normalizeRequest(request)?.signature ?? null;
}

/**
 * Applies one already-reviewed voice removal against exact owner-scoped lots.
 *
 * The caller must resolve names -> pantry IDs before calling this function and
 * preserve the same stable mutationId if a committed operation is retried.
 * Every referenced lot is read before any write. Quantity, unit and revision
 * must still equal the server-confirmed baseline the user reviewed.
 *
 * The immutable journal and stock updates are committed in one Firestore
 * transaction. Journal existence by itself is not independent proof of stock
 * mutation because owner clients can still attempt direct writes under the
 * candidate rules; only this tested writer joins both operations.
 */
export async function persistVerifiedVoiceConsumption(
  db: Firestore,
  request: VerifiedVoiceConsumptionRequest,
): Promise<VerifiedVoiceConsumptionResult> {
  const normalized = normalizeRequest(request);
  if (!normalized) return review("invalid-request");

  const { userId, mutationId } = request;
  const { expectations, deductions, signature } = normalized;
  const journalRef = doc(
    db,
    "inventoryConsumptions",
    getScopedDocumentId(userId, mutationId),
  );
  const stockRefs = expectations.map(expected => ({
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
            data.source !== "voice" ||
            data.requestSignature !== signature ||
            !Array.isArray(data.deductions) ||
            data.deductions.length === 0
          ) {
            return review("conflicting-replay");
          }
          return {
            outcome: "already-recorded" as const,
            mutationId,
            deductions: data.deductions as VerifiedVoiceDeduction[],
          };
        }

        const remote = new Map<string, {
          ref: (typeof stockRefs)[number]["ref"];
          quantity: number;
          unit: string;
          cookRevision: number;
        }>();

        for (const { expected, ref } of stockRefs) {
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
          remote.set(expected.pantryItemId, {
            ref,
            quantity: data.quantity,
            unit: data.unit,
            cookRevision: revision,
          });
        }

        const totals = new Map<string, number>();
        for (const deduction of deductions) {
          const stock = remote.get(deduction.pantryItemId);
          if (!stock) return review("invalid-stock", deduction.pantryItemId);
          if (stock.unit !== deduction.unit) {
            return review("incompatible-unit", deduction.pantryItemId);
          }
          totals.set(
            deduction.pantryItemId,
            roundQuantity(
              (totals.get(deduction.pantryItemId) ?? 0) +
              deduction.consumedQuantity,
            ),
          );
        }

        for (const [pantryItemId, consumed] of totals) {
          const stock = remote.get(pantryItemId);
          if (!stock) return review("invalid-stock", pantryItemId);
          if (consumed > stock.quantity + 1e-9) {
            return review("insufficient-quantity", pantryItemId);
          }
        }

        for (const [pantryItemId, consumed] of totals) {
          const stock = remote.get(pantryItemId);
          if (!stock) return review("invalid-stock", pantryItemId);
          const remaining = roundQuantity(stock.quantity - consumed);
          tx.update(
            stock.ref,
            remaining <= 1e-9
              ? {
                  quantity: 0,
                  lotState: { unallocatedQuantity: 0, activeLots: [] },
                  cookRevision: stock.cookRevision + 1,
                  _deleted: true,
                  deletedAt: serverTimestamp(),
                }
              : {
                  quantity: remaining,
                  lotState: { unallocatedQuantity: remaining, activeLots: [] },
                  estimatedCostEUR: null,
                  cookRevision: stock.cookRevision + 1,
                  _deleted: false,
                  deletedAt: null,
                },
          );
        }

        tx.set(journalRef, {
          userId,
          mutationId,
          source: "voice",
          requestSignature: signature,
          deductions,
          createdAt: serverTimestamp(),
        });

        return {
          outcome: "recorded" as const,
          mutationId,
          deductions,
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

  throw new Error("Voice consumption transaction retry exhausted");
}
