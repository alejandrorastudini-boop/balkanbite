import type { PantryItem, RecipeIngredient } from "../types";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionDeduction,
  type PantryConsumptionIssue,
} from "./pantryConsumption";
import {
  confirmCookTransaction,
  type CookConfirmation,
} from "./confirmedCookTransaction";

export interface RecipeCookPlanInput {
  cookConfirmationId: unknown;
  mealId: unknown;
  pantry: readonly PantryItem[];
  ingredients: readonly RecipeIngredient[];
}

export type RecipeCookPlanResult =
  | {
      outcome: "ready";
      confirmation: CookConfirmation;
      allocations: PantryConsumptionDeduction[];
      expectedRemaining: Record<string, number | null>;
    }
  | {
      outcome: "needs-review";
      issues: Array<{
        ingredientName: string;
        reason: string;
      }>;
    };

const safeJournalId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const safeLogicalId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 300 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const review = (
  ingredientName: string,
  reason: string,
): RecipeCookPlanResult => ({
  outcome: "needs-review",
  issues: [{ ingredientName, reason }],
});

const fromConsumptionIssues = (
  issues: readonly PantryConsumptionIssue[],
): RecipeCookPlanResult => ({
  outcome: "needs-review",
  issues: issues.map(issue => ({
    ingredientName: issue.ingredientName,
    reason: issue.reason,
  })),
});

/**
 * Pure recipe -> exact-lot planner.
 *
 * This function does not persist, journal or mutate pantry. It allocates
 * multiple compatible lots using the existing deterministic consumption
 * engine, then independently verifies the exact ID-based confirmation that the
 * Firestore transaction will receive.
 */
export function planConfirmedRecipeCook(
  input: RecipeCookPlanInput,
): RecipeCookPlanResult {
  const cookConfirmationId = safeJournalId(input?.cookConfirmationId)
    ? input.cookConfirmationId
    : null;
  const mealId = safeLogicalId(input?.mealId) ? input.mealId.trim() : null;

  if (
    !cookConfirmationId ||
    !mealId ||
    !Array.isArray(input.pantry) ||
    !Array.isArray(input.ingredients) ||
    input.ingredients.length === 0
  ) {
    return review("confirmation", "invalid-or-unconfirmed");
  }

  const pantryIds = input.pantry.map(item => item?.id);
  if (
    pantryIds.some(id => !safeLogicalId(id)) ||
    new Set(pantryIds).size !== pantryIds.length
  ) {
    return review("pantry", "ambiguous-pantry-id");
  }

  if (input.ingredients.some(ingredient =>
    !ingredient ||
    typeof ingredient.name !== "string" ||
    !ingredient.name.trim() ||
    typeof ingredient.unit !== "string" ||
    !ingredient.unit.trim() ||
    typeof ingredient.amount !== "number" ||
    !Number.isFinite(ingredient.amount)
  )) {
    return review("confirmation", "invalid-ingredient");
  }

  const preview = deductRecipeIngredientsFromPantry(
    input.pantry.map(item => ({ ...item })),
    input.ingredients.map(ingredient => ({ ...ingredient })),
  );

  if (preview.issues.length > 0) {
    return fromConsumptionIssues(preview.issues);
  }
  if (preview.deductions.length === 0) {
    return review("confirmation", "no-verified-deductions");
  }

  const confirmation: CookConfirmation = {
    cookConfirmationId,
    mealId,
    confirmed: true,
    ingredients: preview.deductions.map((deduction, index) => ({
      ingredientId: `allocation:${index + 1}`,
      pantryItemId: deduction.pantryItemId,
      quantity: deduction.consumedQuantity,
      unit: deduction.unit,
    })),
  };

  const independentlyChecked = confirmCookTransaction(
    {
      pantry: input.pantry.map(item => ({
        id: item.id,
        quantity: item.quantity,
        unit: item.unit,
      })),
      consumptionRecords: [],
    },
    confirmation,
  );

  if (independentlyChecked.outcome !== "recorded") {
    return review("confirmation", "transaction-validation-failed");
  }

  const previewQty = new Map(
    preview.pantry.map(item => [item.id, item.quantity]),
  );
  const checkedQty = new Map(
    independentlyChecked.state.pantry.map(item => [item.id, item.quantity]),
  );

  for (const original of input.pantry) {
    const planned = previewQty.get(original.id) ?? 0;
    const checked = checkedQty.get(original.id) ?? 0;
    if (
      !Number.isFinite(planned) ||
      !Number.isFinite(checked) ||
      Math.abs(planned - checked) > 0.000001
    ) {
      return review("confirmation", "allocation-mismatch");
    }
  }

  const affectedIds = Array.from(new Set(
    preview.deductions.map(item => item.pantryItemId),
  ));
  const expectedRemaining: Record<string, number | null> = {};
  for (const pantryItemId of affectedIds) {
    expectedRemaining[pantryItemId] = previewQty.has(pantryItemId)
      ? previewQty.get(pantryItemId) ?? null
      : null;
  }

  return {
    outcome: "ready",
    confirmation,
    allocations: preview.deductions.map(item => ({ ...item })),
    expectedRemaining,
  };
}
