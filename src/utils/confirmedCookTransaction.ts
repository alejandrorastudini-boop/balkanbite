import {
  deductConfirmedConsumption,
  type ConsumptionDeductionRejection,
  type PantryConsumptionStock,
} from './consumptionDeductions';

export interface CookIngredientConfirmation {
  ingredientId: string;
  pantryItemId: unknown;
  quantity: unknown;
  unit: unknown;
}

export interface CookConfirmation {
  cookConfirmationId: unknown;
  mealId: unknown;
  confirmed: boolean;
  ingredients: readonly CookIngredientConfirmation[];
}

export interface ConsumptionRecord {
  cookConfirmationId: string;
  mealId: string;
  deductions: Array<{
    ingredientId: string;
    pantryItemId: string;
    quantity: number;
    unit: string;
  }>;
}

export interface ConfirmedCookState {
  pantry: PantryConsumptionStock[];
  consumptionRecords: ConsumptionRecord[];
}

export interface PendingCookIngredient {
  ingredientId: string;
  reason: ConsumptionDeductionRejection | 'invalid-ingredient';
}

export type ConfirmedCookResult =
  | { outcome: 'recorded'; state: ConfirmedCookState; record: ConsumptionRecord }
  | { outcome: 'already-recorded'; state: ConfirmedCookState; record: ConsumptionRecord }
  | { outcome: 'needs-review'; state: ConfirmedCookState; pendingIngredients: PendingCookIngredient[] };

function knownId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function unchangedState(state: ConfirmedCookState): ConfirmedCookState {
  return {
    pantry: state.pantry.map(item => ({ ...item })),
    consumptionRecords: state.consumptionRecords.map(record => ({
      ...record,
      deductions: record.deductions.map(deduction => ({ ...deduction })),
    })),
  };
}

/**
 * Applies one explicit cook confirmation as an atomic pantry transaction.
 * A stable confirmation id makes retries idempotent. Any unsafe ingredient
 * remains pending and prevents both deductions and consumption persistence.
 */
export function confirmCookTransaction(
  state: ConfirmedCookState,
  confirmation: CookConfirmation,
): ConfirmedCookResult {
  const cookConfirmationId = knownId(confirmation.cookConfirmationId);
  const mealId = knownId(confirmation.mealId);
  if (!cookConfirmationId || !mealId || confirmation.confirmed !== true || confirmation.ingredients.length === 0) {
    return {
      outcome: 'needs-review',
      state: unchangedState(state),
      pendingIngredients: [{ ingredientId: 'confirmation', reason: 'invalid-ingredient' }],
    };
  }

  const priorRecord = state.consumptionRecords.find(
    record => record.cookConfirmationId === cookConfirmationId,
  );
  if (priorRecord) {
    return {
      outcome: 'already-recorded',
      state: unchangedState(state),
      record: {
        ...priorRecord,
        deductions: priorRecord.deductions.map(deduction => ({ ...deduction })),
      },
    };
  }

  let previewPantry = state.pantry.map(item => ({ ...item }));
  const pendingIngredients: PendingCookIngredient[] = [];
  const deductions: ConsumptionRecord['deductions'] = [];

  for (const ingredient of confirmation.ingredients) {
    const ingredientId = knownId(ingredient.ingredientId);
    const pantryItemId = knownId(ingredient.pantryItemId);
    if (!ingredientId || !pantryItemId) {
      pendingIngredients.push({
        ingredientId: ingredientId ?? 'unknown',
        reason: 'invalid-ingredient',
      });
      continue;
    }

    const deduction = deductConfirmedConsumption(previewPantry, {
      pantryItemId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      confirmed: true,
    });
    if (!deduction.accepted) {
      pendingIngredients.push({ ingredientId, reason: deduction.reason });
      continue;
    }

    previewPantry = deduction.pantry;
    deductions.push({ ingredientId, ...deduction.deducted });
  }

  if (pendingIngredients.length > 0) {
    return {
      outcome: 'needs-review',
      state: unchangedState(state),
      pendingIngredients,
    };
  }

  const record: ConsumptionRecord = { cookConfirmationId, mealId, deductions };
  return {
    outcome: 'recorded',
    state: {
      pantry: previewPantry,
      consumptionRecords: [...state.consumptionRecords, record],
    },
    record,
  };
}
