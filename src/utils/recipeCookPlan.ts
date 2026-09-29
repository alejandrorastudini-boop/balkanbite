import type { PantryItem, RecipeIngredient } from "../types";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionDeduction,
} from "./pantryConsumption";
import type {
  CookConfirmation,
} from "./confirmedCookTransaction";

export interface RecipeCookStockExpectation {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
}

export interface RecipeCookPlan {
  cookConfirmationId: string;
  mealId: string;
  confirmation: CookConfirmation;
  expectedStock: RecipeCookStockExpectation[];
  deductions: PantryConsumptionDeduction[];
  expectedRemaining: Array<{
    pantryItemId: string;
    quantity: number | null;
  }>;
}

export type RecipeCookPlanResult =
  | { outcome: "ready"; plan: RecipeCookPlan }
  | {
      outcome: "needs-review";
      issues: Array<{ ingredientName: string; reason: string }>;
    };

const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canonicalRecipeRequest(
  mealId: string,
  ingredients: readonly RecipeIngredient[],
): string {
  return JSON.stringify({
    version: 1,
    mealId,
    ingredients: ingredients.map(item => ({
      name: item.name.trim(),
      amount: item.amount,
      unit: item.unit.trim(),
    })),
  });
}

/**
 * Resolves one explicit recipe-cook intent to exact pantry lots using the
 * existing deterministic expiry-first allocator. It performs no persistence.
 *
 * The resulting confirmation IDs are safe for the lower-level cook journal,
 * and every affected lot carries the exact quantity/unit/revision observed
 * when the user confirmed the cook.
 */
export function buildRecipeCookPlan(input: {
  cookConfirmationId: unknown;
  mealId: unknown;
  confirmed: boolean;
  pantry: readonly (PantryItem & { cookRevision?: number })[];
  ingredients: readonly RecipeIngredient[];
}): RecipeCookPlanResult {
  const {
    cookConfirmationId,
    mealId,
    confirmed,
    pantry,
    ingredients,
  } = input;

  if (
    !safeId(cookConfirmationId) ||
    !safeId(mealId) ||
    confirmed !== true ||
    !Array.isArray(pantry) ||
    !Array.isArray(ingredients) ||
    ingredients.length === 0 ||
    ingredients.length > 30
  ) {
    return {
      outcome: "needs-review",
      issues: [{ ingredientName: "confirmation", reason: "invalid-request" }],
    };
  }

  const pantryIds = new Set<string>();
  for (const item of pantry) {
    if (
      !item ||
      !safeId(item.id) ||
      pantryIds.has(item.id) ||
      !positive(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      !validRevision(item.cookRevision ?? 0)
    ) {
      return {
        outcome: "needs-review",
        issues: [{ ingredientName: "pantry", reason: "invalid-stock" }],
      };
    }
    pantryIds.add(item.id);
  }

  for (const ingredient of ingredients) {
    if (
      !ingredient ||
      typeof ingredient.name !== "string" ||
      !ingredient.name.trim() ||
      !positive(ingredient.amount) ||
      typeof ingredient.unit !== "string" ||
      !ingredient.unit.trim()
    ) {
      return {
        outcome: "needs-review",
        issues: [{
          ingredientName:
            typeof ingredient?.name === "string"
              ? ingredient.name
              : "ingredient",
          reason: "invalid-ingredient",
        }],
      };
    }
  }

  const preview = deductRecipeIngredientsFromPantry(
    pantry.map(item => ({ ...item })),
    [...ingredients],
  );

  if (preview.issues.length > 0 || preview.deductions.length === 0) {
    return {
      outcome: "needs-review",
      issues: preview.issues.length > 0
        ? preview.issues.map(issue => ({
            ingredientName: issue.ingredientName,
            reason: issue.reason,
          }))
        : [{ ingredientName: "confirmation", reason: "no-deductions" }],
    };
  }

  const recipeHash = fnv1a32(canonicalRecipeRequest(mealId, ingredients));
  const confirmation: CookConfirmation = {
    cookConfirmationId,
    mealId,
    confirmed: true,
    ingredients: preview.deductions.map((deduction, index) => ({
      ingredientId: `allocation-${index + 1}-${recipeHash}`,
      pantryItemId: deduction.pantryItemId,
      quantity: deduction.consumedQuantity,
      unit: deduction.unit,
    })),
  };

  const affectedIds = Array.from(new Set(
    preview.deductions.map(item => item.pantryItemId),
  )).sort();

  const expectedStock: RecipeCookStockExpectation[] = [];
  for (const pantryItemId of affectedIds) {
    const item = pantry.find(candidate => candidate.id === pantryItemId);
    if (!item) {
      return {
        outcome: "needs-review",
        issues: [{ ingredientName: pantryItemId, reason: "missing-stock" }],
      };
    }
    expectedStock.push({
      pantryItemId,
      quantity: item.quantity,
      unit: item.unit,
      cookRevision: item.cookRevision ?? 0,
    });
  }

  const remaining = new Map(
    preview.pantry.map(item => [item.id, item.quantity]),
  );
  const expectedRemaining = affectedIds.map(pantryItemId => ({
    pantryItemId,
    quantity: remaining.has(pantryItemId)
      ? remaining.get(pantryItemId) ?? null
      : null,
  }));

  return {
    outcome: "ready",
    plan: {
      cookConfirmationId,
      mealId,
      confirmation,
      expectedStock,
      deductions: preview.deductions.map(item => ({ ...item })),
      expectedRemaining,
    },
  };
}
