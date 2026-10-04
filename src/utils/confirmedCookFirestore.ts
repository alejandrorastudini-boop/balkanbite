import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  confirmCookTransaction,
  type CookConfirmation,
  type ConsumptionRecord,
  type PendingCookIngredient,
} from "./confirmedCookTransaction";
import { getScopedDocumentId } from "./cloudCollectionSync";
import { isSafeInventoryLogicalId } from "./inventoryIdentity";

export interface AtomicCookExpectedStock {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
}

export type AtomicCookResult =
  | { outcome: "recorded" | "already-recorded"; record: ConsumptionRecord }
  | { outcome: "needs-review"; pendingIngredients: PendingCookIngredient[] };

export interface AtomicCookRequest {
  userId: string;
  confirmation: CookConfirmation;
  expectedStock: readonly AtomicCookExpectedStock[];
}

const safeTokenId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

function reject(
  reason: PendingCookIngredient["reason"],
  ingredientId = "confirmation",
): AtomicCookResult {
  return {
    outcome: "needs-review",
    pendingIngredients: [{ ingredientId, reason }],
  };
}

function normalizeExpectedStock(
  expectedStock: readonly AtomicCookExpectedStock[],
): AtomicCookExpectedStock[] | null {
  if (
    !Array.isArray(expectedStock) ||
    expectedStock.length === 0 ||
    expectedStock.length > 30
  ) {
    return null;
  }

  const ids = new Set<string>();
  const normalized: AtomicCookExpectedStock[] = [];
  for (const item of expectedStock) {
    if (
      !item ||
      !isSafeInventoryLogicalId(item.pantryItemId) ||
      ids.has(item.pantryItemId) ||
      !validQuantity(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      !validRevision(item.cookRevision)
    ) {
      return null;
    }
    ids.add(item.pantryItemId);
    normalized.push({
      pantryItemId: item.pantryItemId,
      quantity: item.quantity,
      unit: item.unit,
      cookRevision: item.cookRevision,
    });
  }

  return normalized.sort((a, b) =>
    a.pantryItemId.localeCompare(b.pantryItemId),
  );
}

/**
 * Deterministic comparison of the exact reviewed cook request.
 * This is not a cryptographic signature or authorization token.
 */
export function cookAllocationSignature(
  confirmation: CookConfirmation,
  expectedStock: readonly AtomicCookExpectedStock[],
): string | null {
  if (
    !safeTokenId(confirmation.cookConfirmationId) ||
    !safeTokenId(confirmation.mealId) ||
    confirmation.confirmed !== true ||
    !Array.isArray(confirmation.ingredients) ||
    confirmation.ingredients.length === 0 ||
    confirmation.ingredients.length > 60
  ) {
    return null;
  }

  const ingredientIds = new Set<string>();
  const allocations: Array<{
    ingredientId: string;
    pantryItemId: string;
    quantity: number;
    unit: string;
  }> = [];
  const referencedStockIds = new Set<string>();

  for (const ingredient of confirmation.ingredients) {
    if (
      !safeTokenId(ingredient.ingredientId) ||
      !isSafeInventoryLogicalId(ingredient.pantryItemId) ||
      !validQuantity(ingredient.quantity) ||
      typeof ingredient.unit !== "string" ||
      !ingredient.unit.trim() ||
      ingredientIds.has(ingredient.ingredientId)
    ) {
      return null;
    }
    ingredientIds.add(ingredient.ingredientId);
    referencedStockIds.add(ingredient.pantryItemId);
    allocations.push({
      ingredientId: ingredient.ingredientId,
      pantryItemId: ingredient.pantryItemId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    });
  }

  const normalizedExpected = normalizeExpectedStock(expectedStock);
  if (!normalizedExpected) return null;
  const expectedIds = new Set(
    normalizedExpected.map(item => item.pantryItemId),
  );
  if (
    referencedStockIds.size !== expectedIds.size ||
    [...referencedStockIds].some(id => !expectedIds.has(id))
  ) {
    return null;
  }

  allocations.sort((a, b) =>
    a.ingredientId.localeCompare(b.ingredientId) ||
    a.pantryItemId.localeCompare(b.pantryItemId) ||
    a.unit.localeCompare(b.unit) ||
    a.quantity - b.quantity,
  );

  return JSON.stringify({
    version: 2,
    mealId: confirmation.mealId,
    allocations,
    expectedStock: normalizedExpected,
  });
}

/**
 * Reads the journal first, then every referenced authoritative stock document
 * before writing anything. A committed exact replay returns from the immutable
 * journal even though stock has already changed. A fresh cook requires every
 * lot to still match the user-reviewed quantity, unit and revision.
 */
export async function persistConfirmedCookAtomically(
  db: Firestore,
  request: AtomicCookRequest,
): Promise<AtomicCookResult> {
  const { userId, confirmation } = request;
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(userId) ||
    !safeTokenId(confirmation.cookConfirmationId)
  ) {
    return reject("invalid-ingredient");
  }

  const normalizedExpected = normalizeExpectedStock(request.expectedStock);
  const signature = normalizedExpected
    ? cookAllocationSignature(confirmation, normalizedExpected)
    : null;
  if (!normalizedExpected || !signature) {
    return reject("invalid-ingredient");
  }

  const cookId = confirmation.cookConfirmationId as string;
  const journalRef = doc(
    db,
    "cookConfirmations",
    getScopedDocumentId(userId, cookId),
  );
  const expectedById = new Map(
    normalizedExpected.map(item => [item.pantryItemId, item]),
  );
  const stockRefs = normalizedExpected.map(expected => ({
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
            data.cookConfirmationId !== cookId ||
            data.mealId !== confirmation.mealId ||
            data.requestSignature !== signature ||
            !Array.isArray(data.deductions) ||
            data.deductions.length === 0
          ) {
            return reject("invalid-ingredient");
          }
          return {
            outcome: "already-recorded" as const,
            record: {
              cookConfirmationId: cookId,
              mealId: confirmation.mealId as string,
              deductions:
                data.deductions as ConsumptionRecord["deductions"],
            },
          };
        }

        const stock = [];
        const revisions = new Map<string, number>();

        for (const { expected, ref } of stockRefs) {
          const snapshot = await tx.get(ref);
          if (!snapshot.exists()) {
            return reject("stock-not-found", expected.pantryItemId);
          }
          const data = snapshot.data();
          const revision = data.cookRevision ?? 0;
          if (
            data.userId !== userId ||
            data.id !== expected.pantryItemId ||
            data._deleted === true ||
            !validQuantity(data.quantity) ||
            typeof data.unit !== "string" ||
            !data.unit.trim() ||
            !validRevision(revision)
          ) {
            return reject("invalid-stock", expected.pantryItemId);
          }

          if (
            data.quantity !== expected.quantity ||
            data.unit !== expected.unit ||
            revision !== expected.cookRevision
          ) {
            return reject("stale-stock", expected.pantryItemId);
          }

          revisions.set(expected.pantryItemId, revision);
          stock.push({
            id: expected.pantryItemId,
            quantity: data.quantity as number,
            unit: data.unit as string,
          });
        }

        for (const ingredient of confirmation.ingredients) {
          if (
            typeof ingredient.pantryItemId !== "string" ||
            !expectedById.has(ingredient.pantryItemId)
          ) {
            return reject(
              "invalid-ingredient",
              typeof ingredient.ingredientId === "string"
                ? ingredient.ingredientId
                : "unknown",
            );
          }
        }

        const checked = confirmCookTransaction(
          { pantry: stock, consumptionRecords: [] },
          confirmation,
        );
        if (checked.outcome !== "recorded") {
          return checked.outcome === "needs-review"
            ? {
                outcome: "needs-review" as const,
                pendingIngredients: checked.pendingIngredients,
              }
            : reject("invalid-ingredient");
        }

        const remaining = new Map(
          checked.state.pantry.map(item => [item.id, item.quantity]),
        );
        for (const { expected, ref } of stockRefs) {
          const quantity = remaining.get(expected.pantryItemId);
          if (
            quantity === undefined ||
            !Number.isFinite(quantity) ||
            quantity < 0
          ) {
            return reject("invalid-stock", expected.pantryItemId);
          }
          const cookRevision = revisions.get(expected.pantryItemId);
          if (cookRevision === undefined) {
            return reject("invalid-stock", expected.pantryItemId);
          }

          tx.update(
            ref,
            quantity === 0
              ? {
                  quantity: 0,
                  lotState: { unallocatedQuantity: 0, activeLots: [] },
                  cookRevision: cookRevision + 1,
                  _deleted: true,
                  deletedAt: serverTimestamp(),
                }
              : {
                  quantity,
                  lotState: { unallocatedQuantity: quantity, activeLots: [] },
                  estimatedCostEUR: null,
                  cookRevision: cookRevision + 1,
                  _deleted: false,
                  deletedAt: null,
                },
          );
        }

        tx.set(journalRef, {
          userId,
          cookConfirmationId: cookId,
          mealId: checked.record.mealId,
          requestSignature: signature,
          deductions: checked.record.deductions,
          createdAt: serverTimestamp(),
        });

        return {
          outcome: "recorded" as const,
          record: checked.record,
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

  throw new Error("Cook transaction retry exhausted");
}
