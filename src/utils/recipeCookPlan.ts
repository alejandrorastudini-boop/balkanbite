import type { PantryItem, Recipe } from "../types";
import type { CookConfirmation } from "./confirmedCookTransaction";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionResult,
} from "./pantryConsumption";

export interface PreparedRecipeCookPlan {
  confirmation: CookConfirmation;
  result: PantryConsumptionResult;
  expectedRemaining: Record<string, number | null>;
}

export type PrepareRecipeCookResult =
  | { outcome: "ready"; plan: PreparedRecipeCookPlan }
  | { outcome: "needs-review"; issueCount: number };

const safeConfirmationId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const safeMealId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 300 &&
  value === value.trim() &&
  !/[\u0000-\u001F\u007F]/.test(value);

/**
 * Resolves one explicitly confirmed recipe against the exact pantry snapshot
 * currently visible to the user. Multi-lot allocation is delegated to the
 * deterministic expiry-first pantry engine.
 *
 * This is planning only: no local or cloud stock is mutated here.
 */
export function prepareRecipeCookPlan(
  recipe: Recipe,
  pantry: readonly PantryItem[],
  cookConfirmationId: string,
): PrepareRecipeCookResult {
  if (
    !recipe ||
    !safeMealId(recipe.id) ||
    !safeConfirmationId(cookConfirmationId) ||
    !Array.isArray(recipe.ingredients) ||
    recipe.ingredients.length === 0 ||
    !Array.isArray(pantry)
  ) {
    return { outcome: "needs-review", issueCount: 1 };
  }

  const preview = deductRecipeIngredientsFromPantry(
    pantry.map(item => ({ ...item })),
    recipe.ingredients.map(item => ({ ...item })),
  );
  if (preview.issues.length > 0 || preview.deductions.length === 0) {
    return {
      outcome: "needs-review",
      issueCount: Math.max(1, preview.issues.length),
    };
  }

  const affectedIds = Array.from(
    new Set(preview.deductions.map(item => item.pantryItemId)),
  );
  const remaining = new Map(
    preview.pantry.map(item => [item.id, item.quantity]),
  );
  const expectedRemaining: Record<string, number | null> = {};
  for (const pantryItemId of affectedIds) {
    expectedRemaining[pantryItemId] = remaining.has(pantryItemId)
      ? remaining.get(pantryItemId) ?? null
      : null;
  }

  const confirmation: CookConfirmation = {
    cookConfirmationId,
    mealId: recipe.id,
    confirmed: true,
    ingredients: preview.deductions.map((deduction, index) => ({
      // Internal allocation identity only; never infer a recipe-ingredient ID.
      ingredientId: `allocation-${index + 1}`,
      pantryItemId: deduction.pantryItemId,
      quantity: deduction.consumedQuantity,
      unit: deduction.unit,
    })),
  };

  return {
    outcome: "ready",
    plan: {
      confirmation,
      result: {
        pantry: preview.pantry.map(item => ({ ...item })),
        deductions: preview.deductions.map(item => ({ ...item })),
        issues: [],
      },
      expectedRemaining,
    },
  };
}
