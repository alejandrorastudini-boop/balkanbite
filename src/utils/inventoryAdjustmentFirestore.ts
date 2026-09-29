import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { getScopedDocumentId } from "./cloudCollectionSync";

/**
 * Candidate revision-aware writer for an already identified pantry lot.
 * The expected values MUST originate from a verified, owner-scoped remote
 * snapshot, never an AI guess or an unsynchronized local default.
 *
 * This function is not yet wired to useFirebaseSync. A correct deployment
 * requires replacing/coordinating that hook's legacy all-row batch writer.
 */
export interface VerifiedStockExpectation {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
}

export type InventoryAdjustment =
  | { kind: "set-quantity"; quantity: number }
  | { kind: "remove" };

export type InventoryAdjustmentOutcome =
  | { outcome: "updated"; quantity: number; cookRevision: number }
  | { outcome: "removed"; cookRevision: number }
  | {
      outcome: "needs-review";
      reason: "invalid-request" | "missing-stock" | "invalid-stock" |
        "stale-stock" | "no-change";
    };

const safeId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(id);

const safeUid = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);

const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= 0 && value < Number.MAX_SAFE_INTEGER;

const review = (reason: Extract<InventoryAdjustmentOutcome, { outcome: "needs-review" }>["reason"])
  : InventoryAdjustmentOutcome => ({ outcome: "needs-review", reason });

/**
 * Uses a transaction, not a blind merge: stale stock is rejected after
 * re-reading the exact remote lot. Concurrent stock writes trigger a fresh
 * read, so only one edit using the same expected quantity/revision can win.
 */
export async function persistVerifiedInventoryAdjustment(
  db: Firestore,
  userId: string,
  expected: VerifiedStockExpectation,
  adjustment: InventoryAdjustment,
): Promise<InventoryAdjustmentOutcome> {
  if (!safeUid(userId) || !safeId(expected.pantryItemId) ||
      !validQuantity(expected.quantity) ||
      typeof expected.unit !== "string" || !expected.unit.trim() ||
      !validRevision(expected.cookRevision) ||
      (adjustment.kind !== "remove" &&
        (adjustment.kind !== "set-quantity" || !validQuantity(adjustment.quantity)))) {
    return review("invalid-request");
  }

  if (adjustment.kind === "set-quantity" && adjustment.quantity === expected.quantity) {
    return review("no-change");
  }

  const reference = doc(db, "inventory", getScopedDocumentId(userId, expected.pantryItemId));

  // The current candidate rules may reject a raced revision as PERMISSION_DENIED
  // rather than the SDK's retryable ABORTED. Retry a bounded number of times
  // with fresh remote reads; persistent permission failures propagate.
  for (let outerAttempt = 0; outerAttempt < 3; outerAttempt++) {
    try {
      return await runTransaction(db, async tx => {
        const snapshot = await tx.get(reference);
        if (!snapshot.exists()) return review("missing-stock");
        const remote = snapshot.data();
        if (remote.userId !== userId ||
            remote.id !== expected.pantryItemId ||
            remote._deleted === true ||
            !validQuantity(remote.quantity) ||
            typeof remote.unit !== "string" || !remote.unit.trim() ||
            !validRevision(remote.cookRevision ?? 0)) {
          return review("invalid-stock");
        }
        const revision = remote.cookRevision ?? 0;
        if (revision !== expected.cookRevision ||
            remote.quantity !== expected.quantity ||
            remote.unit !== expected.unit) {
          return review("stale-stock");
        }

        const nextRevision = revision + 1;
        if (adjustment.kind === "remove") {
          tx.update(reference, {
            quantity: 0,
            cookRevision: nextRevision,
            _deleted: true,
            deletedAt: serverTimestamp(),
          });
          return { outcome: "removed" as const, cookRevision: nextRevision };
        }

        tx.update(reference, {
          quantity: adjustment.quantity,
          cookRevision: nextRevision,
          _deleted: false,
          deletedAt: null,
        });
        return {
          outcome: "updated" as const,
          quantity: adjustment.quantity,
          cookRevision: nextRevision,
        };
      }, { maxAttempts: 5 });
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code !== "permission-denied" ||
          outerAttempt === 2) throw error;
    }
  }
  throw new Error("Inventory adjustment retry exhausted");
}
