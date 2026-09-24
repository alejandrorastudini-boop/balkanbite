import {
  doc, runTransaction, serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  confirmCookTransaction,
  type CookConfirmation,
  type ConsumptionRecord,
  type PendingCookIngredient,
} from "./confirmedCookTransaction";
import { getScopedDocumentId } from "./cloudCollectionSync";

/**
 * Candidate transactional writer for an explicit, ID-resolved cook.
 * NOT wired into the UI. The current useFirebaseSync inventory writer must
 * be coordinated before activation or stale local batches could undo stock.
 * The caller must first obtain complete, user-reviewed lot allocations.
 */
export type AtomicCookResult =
  | { outcome: "recorded" | "already-recorded"; record: ConsumptionRecord }
  | { outcome: "needs-review"; pendingIngredients: PendingCookIngredient[] };

export interface AtomicCookRequest {
  userId: string;
  confirmation: CookConfirmation;
}

const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function reject(reason: PendingCookIngredient["reason"], ingredientId = "confirmation"): AtomicCookResult {
  return { outcome: "needs-review", pendingIngredients: [{ ingredientId, reason }] };
}

/**
 * A deterministic comparison of the exact stock allocations being committed.
 * It is not a cryptographic signature or proof of inventory provenance.
 */
export function cookAllocationSignature(confirmation: CookConfirmation): string | null {
  if (!safeId(confirmation.cookConfirmationId) ||
      !safeId(confirmation.mealId) ||
      confirmation.confirmed !== true ||
      !Array.isArray(confirmation.ingredients) ||
      confirmation.ingredients.length === 0 ||
      confirmation.ingredients.length > 30) return null;

  const ingredientIds = new Set<string>();
  const normalized = [];
  for (const ingredient of confirmation.ingredients) {
    if (!safeId(ingredient.ingredientId) ||
        !safeId(ingredient.pantryItemId) ||
        !validQuantity(ingredient.quantity) ||
        typeof ingredient.unit !== "string" || !ingredient.unit.trim() ||
        ingredientIds.has(ingredient.ingredientId)) return null;
    ingredientIds.add(ingredient.ingredientId);
    normalized.push({
      ingredientId: ingredient.ingredientId,
      pantryItemId: ingredient.pantryItemId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    });
  }
  return JSON.stringify({ version: 1, mealId: confirmation.mealId, allocations: normalized });
}

/**
 * Reads the target journal and every referenced authoritative stock document
 * BEFORE writing anything. Firestore retries the callback on read-version
 * conflicts; a conflicting cook ID or a now-insufficient lot fails closed.
 *
 * Rules independently enforce owner namespace and journal immutability.
 * A journal document alone cannot prove that stock changed: only this
 * transaction joins its creation to the validated inventory updates.
 */
export async function persistConfirmedCookAtomically(
  db: Firestore,
  request: AtomicCookRequest,
): Promise<AtomicCookResult> {
  const { userId, confirmation } = request;
  // Current rule namespace is based on the literal auth UID, not a URL-encoded UID.
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId) ||
      !safeId(confirmation.cookConfirmationId)) {
    return reject("invalid-ingredient");
  }
  const signature = cookAllocationSignature(confirmation);
  if (!signature) return reject("invalid-ingredient");

  const cookId = confirmation.cookConfirmationId as string;
  const journalRef = doc(db, "cookConfirmations", getScopedDocumentId(userId, cookId));
  const uniqueStockIds = Array.from(new Set(
    confirmation.ingredients.map(item => item.pantryItemId as string),
  )).sort();
  const stockRefs = uniqueStockIds.map(id => ({
    id, ref: doc(db, "inventory", getScopedDocumentId(userId, id)),
  }));

  return runTransaction(db, async tx => {
    const prior = await tx.get(journalRef);
    if (prior.exists()) {
      const data = prior.data();
      if (data.userId !== userId ||
          data.cookConfirmationId !== cookId ||
          data.mealId !== confirmation.mealId ||
          data.requestSignature !== signature ||
          !Array.isArray(data.deductions) ||
          data.deductions.length === 0) {
        return reject("invalid-ingredient");
      }
      return {
        outcome: "already-recorded" as const,
        record: {
          cookConfirmationId: cookId,
          mealId: confirmation.mealId as string,
          deductions: data.deductions as ConsumptionRecord["deductions"],
        },
      };
    }

    const stock = [];
    for (const { id, ref } of stockRefs) {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) return reject("stock-not-found", id);
      const data = snapshot.data();
      if (data.userId !== userId ||
          data.id !== id ||
          data._deleted === true ||
          !validQuantity(data.quantity) ||
          typeof data.unit !== "string") {
        return reject("invalid-stock", id);
      }
      stock.push({ id, quantity: data.quantity as number, unit: data.unit as string });
    }

    const checked = confirmCookTransaction({
      pantry: stock,
      consumptionRecords: [],
    }, confirmation);
    if (checked.outcome !== "recorded") {
      return checked.outcome === "needs-review"
        ? { outcome: "needs-review" as const, pendingIngredients: checked.pendingIngredients }
        : reject("invalid-ingredient");
    }
    const remaining = new Map(checked.state.pantry.map(item => [item.id, item.quantity]));
    for (const { id, ref } of stockRefs) {
      const quantity = remaining.get(id);
      if (quantity === undefined || !Number.isFinite(quantity) || quantity < 0) {
        return reject("invalid-stock", id);
      }
      tx.update(ref, quantity === 0
        ? { quantity: 0, _deleted: true, deletedAt: serverTimestamp() }
        : { quantity, _deleted: false, deletedAt: null });
    }
    tx.set(journalRef, {
      userId, cookConfirmationId: cookId,
      mealId: checked.record.mealId,
      requestSignature: signature,
      deductions: checked.record.deductions,
      createdAt: serverTimestamp(),
    });
    return { outcome: "recorded" as const, record: checked.record };
  }, { maxAttempts: 5 });
}
