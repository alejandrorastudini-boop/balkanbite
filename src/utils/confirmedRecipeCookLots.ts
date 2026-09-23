import type { PantryItem, RecipeIngredient } from "../types";
import {
  confirmCookTransaction,
  type ConsumptionRecord,
} from "./confirmedCookTransaction";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionDeduction,
} from "./pantryConsumption";

/**
 * Pure bridge between recipe-name/multi-lot allocation and the existing
 * ID-based confirmation journal. NOT a persistence or cloud transaction.
 * Callers must supply a stable confirmation ID and persist the returned
 * pantry + consumption records together under their actual authority boundary.
 */
export interface ConfirmedRecipeCookState {
  pantry: PantryItem[];
  consumptionRecords: ConsumptionRecord[];
}

export interface ConfirmRecipeCookInput {
  cookConfirmationId: unknown;
  mealId: unknown;
  confirmed: boolean;
  ingredients: readonly RecipeIngredient[];
}

export type ConfirmedRecipeCookResult =
  | {
      outcome: "recorded";
      state: ConfirmedRecipeCookState;
      record: ConsumptionRecord;
      allocations: PantryConsumptionDeduction[];
    }
  | {
      outcome: "already-recorded";
      state: ConfirmedRecipeCookState;
      record: ConsumptionRecord;
    }
  | {
      outcome: "needs-review";
      state: ConfirmedRecipeCookState;
      issues: Array<{ ingredientName: string; reason: string }>;
    };

function knownId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cloneState(state: ConfirmedRecipeCookState): ConfirmedRecipeCookState {
  return {
    pantry: state.pantry.map(item => ({ ...item })),
    consumptionRecords: state.consumptionRecords.map(record => ({
      ...record,
      deductions: record.deductions.map(d => ({ ...d })),
    })),
  };
}

function review(
  state: ConfirmedRecipeCookState,
  ingredientName: string,
  reason: string,
): ConfirmedRecipeCookResult {
  return {
    outcome: "needs-review",
    state: cloneState(state),
    issues: [{ ingredientName, reason }],
  };
}

export function confirmRecipeCookWithLots(
  state: ConfirmedRecipeCookState,
  input: ConfirmRecipeCookInput,
): ConfirmedRecipeCookResult {
  const id = knownId(input.cookConfirmationId);
  const mealId = knownId(input.mealId);
  if (!id || !mealId || input.confirmed !== true ||
      !Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    return review(state, "confirmation", "invalid-or-unconfirmed");
  }

  const prior = state.consumptionRecords.find(record => record.cookConfirmationId === id);
  if (prior) {
    if (prior.mealId !== mealId) {
      return review(state, "confirmation", "confirmation-id-conflict");
    }
    return {
      outcome: "already-recorded",
      state: cloneState(state),
      record: {
        ...prior,
        deductions: prior.deductions.map(d => ({ ...d })),
      },
    };
  }

  // Ambiguous IDs must never be resolved by choosing the first pantry row.
  const pantryIds = state.pantry.map(item => item.id);
  if (pantryIds.some(id => !knownId(id)) || new Set(pantryIds).size !== pantryIds.length) {
    return review(state, "pantry", "ambiguous-pantry-id");
  }

  // The existing quantitative engine allocates multiple compatible lots in
  // expiry order; any unresolved ingredient aborts the entire proposal.
  const preview = deductRecipeIngredientsFromPantry(
    state.pantry,
    [...input.ingredients],
  );
  if (preview.issues.length > 0) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: preview.issues.map(issue => ({
        ingredientName: issue.ingredientName,
        reason: issue.reason,
      })),
    };
  }
  if (preview.deductions.length === 0) {
    return review(state, "confirmation", "no-verified-deductions");
  }

  // Allocation IDs identify internal stock deductions, not inferred recipe
  // ingredient IDs. These exact lots and quantities are checked again by
  // the existing ID-based confirmation primitive before committing.
  const verified = confirmCookTransaction({
    pantry: state.pantry.map(item => ({
      id: item.id, quantity: item.quantity, unit: item.unit,
    })),
    consumptionRecords: state.consumptionRecords,
  }, {
    cookConfirmationId: id,
    mealId,
    confirmed: true,
    ingredients: preview.deductions.map((d, index) => ({
      ingredientId: `allocation:${index + 1}`,
      pantryItemId: d.pantryItemId,
      quantity: d.consumedQuantity,
      unit: d.unit,
    })),
  });
  if (verified.outcome !== "recorded") {
    return review(state, "confirmation", "transaction-validation-failed");
  }

  // The two independent calculations must agree; zeroed lots are removed by
  // the recipe engine but retained at zero by the lower-level primitive.
  const verifiedQty = new Map(verified.state.pantry.map(item => [item.id, item.quantity]));
  const previewQty = new Map(preview.pantry.map(item => [item.id, item.quantity]));
  if (verified.state.pantry.some(item =>
    !Number.isFinite(item.quantity) ||
    Math.abs(item.quantity - (previewQty.get(item.id) ?? 0)) > 0.000001
  ) || preview.pantry.some(item =>
    !verifiedQty.has(item.id)
  )) {
    return review(state, "confirmation", "allocation-mismatch");
  }

  return {
    outcome: "recorded",
    state: {
      pantry: preview.pantry,
      consumptionRecords: verified.state.consumptionRecords,
    },
    record: verified.record,
    allocations: preview.deductions,
  };
}
