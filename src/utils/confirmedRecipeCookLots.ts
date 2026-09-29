import type { PantryItem, RecipeIngredient } from "../types";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionDeduction,
  type PantryConsumptionIssue,
} from "./pantryConsumption";
import {
  cookRequestSignature,
  type AtomicCookExpectedStock,
  type AtomicCookRequest,
} from "./confirmedCookFirestore";

export interface RecipeCookPlanInput {
  userId: string;
  cookConfirmationId: unknown;
  mealId: unknown;
  confirmed: boolean;
  pantry: readonly PantryItem[];
  authoritativeStock: readonly AtomicCookExpectedStock[];
  ingredients: readonly RecipeIngredient[];
}

export type RecipeCookPlanResult =
  | {
      outcome: "planned";
      request: AtomicCookRequest;
      signature: string;
      allocations: PantryConsumptionDeduction[];
      expectedPantry: PantryItem[];
      expectedRemaining: Record<string, number | null>;
    }
  | {
      outcome: "needs-review";
      issues: Array<{
        ingredientName: string;
        reason:
          | PantryConsumptionIssue["reason"]
          | "invalid-confirmation"
          | "ambiguous-pantry-id"
          | "unverified-authority"
          | "stale-visible-pantry";
      }>;
    };

const safeLogicalId = (value: unknown): value is string =>
  typeof value === "string" &&
  Boolean(value.trim()) &&
  value.length <= 300 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

const review = (
  ingredientName: string,
  reason: RecipeCookPlanResult extends infer _T ? never : never,
) => ({ ingredientName, reason });

// Type-safe wrapper kept explicit instead of widening issue reasons elsewhere.
function needsReview(
  ingredientName: string,
  reason:
    | PantryConsumptionIssue["reason"]
    | "invalid-confirmation"
    | "ambiguous-pantry-id"
    | "unverified-authority"
    | "stale-visible-pantry",
): RecipeCookPlanResult {
  return { outcome: "needs-review", issues: [{ ingredientName, reason }] };
}

export function planRecipeCookAgainstAuthoritativePantry(
  input: RecipeCookPlanInput,
): RecipeCookPlanResult {
  if (
    !input ||
    typeof input.userId !== "string" ||
    !input.userId.trim() ||
    input.confirmed !== true ||
    !Array.isArray(input.pantry) ||
    !Array.isArray(input.authoritativeStock) ||
    !Array.isArray(input.ingredients) ||
    input.ingredients.length === 0
  ) {
    return needsReview("confirmation", "invalid-confirmation");
  }

  const pantryIds = new Set<string>();
  for (const item of input.pantry) {
    if (
      !item ||
      !safeLogicalId(item.id) ||
      pantryIds.has(item.id) ||
      !positive(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim()
    ) {
      return needsReview("pantry", "ambiguous-pantry-id");
    }
    pantryIds.add(item.id);
  }

  const authorityById = new Map<string, AtomicCookExpectedStock>();
  for (const item of input.authoritativeStock) {
    if (
      !item ||
      !safeLogicalId(item.pantryItemId) ||
      authorityById.has(item.pantryItemId) ||
      !positive(item.quantity) ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      !validRevision(item.cookRevision)
    ) {
      return needsReview("pantry", "unverified-authority");
    }
    authorityById.set(item.pantryItemId, { ...item });
  }

  if (
    authorityById.size !== input.pantry.length ||
    input.pantry.some(item => !authorityById.has(item.id))
  ) {
    return needsReview("pantry", "unverified-authority");
  }

  for (const visible of input.pantry) {
    const authority = authorityById.get(visible.id);
    if (
      !authority ||
      visible.quantity !== authority.quantity ||
      visible.unit !== authority.unit
    ) {
      return needsReview(visible.name || visible.id, "stale-visible-pantry");
    }
  }

  const preview = deductRecipeIngredientsFromPantry(
    input.pantry.map(item => ({ ...item })),
    input.ingredients.map(ingredient => ({ ...ingredient })),
  );

  if (preview.issues.length > 0) {
    return {
      outcome: "needs-review",
      issues: preview.issues.map(issue => ({
        ingredientName: issue.ingredientName,
        reason: issue.reason,
      })),
    };
  }

  if (preview.deductions.length === 0) {
    return needsReview("confirmation", "invalid-confirmation");
  }

  const affectedIds = Array.from(new Set(
    preview.deductions.map(deduction => deduction.pantryItemId),
  ));
  const expectedStock: AtomicCookExpectedStock[] = [];
  for (const pantryItemId of affectedIds) {
    const authority = authorityById.get(pantryItemId);
    if (!authority) {
      return needsReview(pantryItemId, "unverified-authority");
    }
    expectedStock.push({ ...authority });
  }

  const request: AtomicCookRequest = {
    userId: input.userId,
    confirmation: {
      cookConfirmationId: input.cookConfirmationId,
      mealId: input.mealId,
      confirmed: true,
      ingredients: preview.deductions.map((deduction, index) => ({
        ingredientId: `allocation-${index + 1}`,
        pantryItemId: deduction.pantryItemId,
        quantity: deduction.consumedQuantity,
        unit: deduction.unit,
      })),
    },
    expectedStock,
  };

  const signature = cookRequestSignature(request);
  if (!signature) {
    return needsReview("confirmation", "invalid-confirmation");
  }

  const remainingById = new Map(
    preview.pantry.map(item => [item.id, item.quantity]),
  );
  const expectedRemaining: Record<string, number | null> = {};
  for (const pantryItemId of affectedIds) {
    expectedRemaining[pantryItemId] = remainingById.has(pantryItemId)
      ? remainingById.get(pantryItemId) ?? null
      : null;
  }

  return {
    outcome: "planned",
    request,
    signature,
    allocations: preview.deductions.map(item => ({ ...item })),
    expectedPantry: preview.pantry.map(item => ({ ...item })),
    expectedRemaining,
  };
}
