import type { PantryItem, Recipe } from "../types";
import {
  confirmCookTransaction,
  type ConsumptionRecord,
} from "./confirmedCookTransaction";
import {
  applyInventoryMutation,
  type InventoryMutationRecord,
} from "./inventoryMutationJournal";
import {
  deductRecipeIngredientsFromPantry,
  type PantryConsumptionIssue,
} from "./pantryConsumption";

export interface RecipeCookDomainState {
  pantry: PantryItem[];
  consumptionRecords: ConsumptionRecord[];
  inventoryJournal: InventoryMutationRecord[];
}

export interface RecipeCookDomainRequest {
  recipe: Recipe;
  cookConfirmationId: unknown;
  occurredAt: unknown;
  confirmed: boolean;
}

export type RecipeCookDomainIssue =
  | {
      type: "invalid-confirmation";
      detail: "cook-confirmation-id" | "meal-id" | "occurred-at" | "unconfirmed" | "no-ingredients";
    }
  | {
      type: "ingredient";
      ingredientIndex: number;
      ingredientName: string;
      reason: PantryConsumptionIssue["reason"] | "transaction-rejected";
    }
  | {
      type: "journal";
      mutationId: string;
      reason: string;
    };

export type RecipeCookDomainResult =
  | {
      outcome: "recorded";
      state: RecipeCookDomainState;
      record: ConsumptionRecord;
      journalMutations: InventoryMutationRecord[];
    }
  | {
      outcome: "already-recorded";
      state: RecipeCookDomainState;
      record: ConsumptionRecord;
    }
  | {
      outcome: "needs-review";
      state: RecipeCookDomainState;
      issues: RecipeCookDomainIssue[];
    };

const knownText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const cloneState = (state: RecipeCookDomainState): RecipeCookDomainState => ({
  pantry: state.pantry.map((item) => ({
    ...item,
    purchaseHistory: item.purchaseHistory?.map((entry) => ({ ...entry })),
  })),
  consumptionRecords: state.consumptionRecords.map((record) => ({
    ...record,
    deductions: record.deductions.map((deduction) => ({ ...deduction })),
  })),
  inventoryJournal: state.inventoryJournal.map((mutation) => ({
    ...mutation,
    source: { ...mutation.source },
  })),
});

/**
 * Resolves one explicitly confirmed recipe cook into a single atomic domain
 * transaction:
 *   recipe requirements -> exact pantry lots -> consumption record -> inventory journal.
 *
 * The caller supplies both the stable confirmation id and timestamp. This
 * function never invents user facts, timestamps, quantities, or units.
 */
export function transactConfirmedRecipeCook(
  state: RecipeCookDomainState,
  request: RecipeCookDomainRequest,
): RecipeCookDomainResult {
  const cookConfirmationId = knownText(request.cookConfirmationId);
  const mealId = knownText(request.recipe?.id);
  const occurredAt = knownText(request.occurredAt);

  if (!cookConfirmationId) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: [{ type: "invalid-confirmation", detail: "cook-confirmation-id" }],
    };
  }
  if (!mealId) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: [{ type: "invalid-confirmation", detail: "meal-id" }],
    };
  }
  if (!occurredAt) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: [{ type: "invalid-confirmation", detail: "occurred-at" }],
    };
  }
  if (request.confirmed !== true) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: [{ type: "invalid-confirmation", detail: "unconfirmed" }],
    };
  }
  if (!Array.isArray(request.recipe.ingredients) || request.recipe.ingredients.length === 0) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: [{ type: "invalid-confirmation", detail: "no-ingredients" }],
    };
  }

  const priorRecord = state.consumptionRecords.find(
    (record) => record.cookConfirmationId === cookConfirmationId,
  );
  if (priorRecord) {
    return {
      outcome: "already-recorded",
      state: cloneState(state),
      record: {
        ...priorRecord,
        deductions: priorRecord.deductions.map((deduction) => ({ ...deduction })),
      },
    };
  }

  const resolution = deductRecipeIngredientsFromPantry(
    state.pantry,
    request.recipe.ingredients,
  );
  if (resolution.issues.length > 0) {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: resolution.issues.map((issue) => {
        const ingredientIndex = request.recipe.ingredients.findIndex(
          (ingredient) =>
            ingredient.name === issue.ingredientName &&
            ingredient.amount === issue.requiredAmount &&
            ingredient.unit === issue.requiredUnit,
        );
        return {
          type: "ingredient" as const,
          ingredientIndex,
          ingredientName: issue.ingredientName,
          reason: issue.reason,
        };
      }),
    };
  }

  const confirmationIngredients = resolution.deductions.map(
    (deduction, deductionIndex) => ({
      ingredientId:
        `${mealId}:ingredient:${deduction.ingredientIndex}:deduction:${deductionIndex}`,
      pantryItemId: deduction.pantryItemId,
      quantity: deduction.consumedQuantity,
      unit: deduction.unit,
    }),
  );

  const confirmed = confirmCookTransaction(
    {
      pantry: state.pantry.map(({ id, quantity, unit }) => ({
        id,
        quantity,
        unit,
      })),
      consumptionRecords: state.consumptionRecords,
    },
    {
      cookConfirmationId,
      mealId,
      confirmed: true,
      ingredients: confirmationIngredients,
    },
  );

  if (confirmed.outcome === "needs-review") {
    return {
      outcome: "needs-review",
      state: cloneState(state),
      issues: confirmed.pendingIngredients.map((pending) => ({
        type: "ingredient",
        ingredientIndex: -1,
        ingredientName: pending.ingredientId,
        reason: "transaction-rejected",
      })),
    };
  }

  if (confirmed.outcome === "already-recorded") {
    return {
      outcome: "already-recorded",
      state: cloneState(state),
      record: confirmed.record,
    };
  }

  const journalMutations: InventoryMutationRecord[] =
    confirmed.record.deductions.map((deduction, index) => ({
      id: `${cookConfirmationId}:consumption:${index}`,
      inventoryItemId: deduction.pantryItemId,
      source: {
        type: "consumption",
        id: cookConfirmationId,
      },
      quantityDelta: -deduction.quantity,
      unit: deduction.unit,
      occurredAt,
    }));

  let journalPreview = {
    inventory: state.pantry.map((item) => ({
      ...item,
      purchaseHistory: item.purchaseHistory?.map((entry) => ({ ...entry })),
    })),
    journal: state.inventoryJournal.map((mutation) => ({
      ...mutation,
      source: { ...mutation.source },
    })),
  };

  for (const mutation of journalMutations) {
    const applied = applyInventoryMutation(journalPreview, { mutation });
    if (applied.accepted === false) {
      return {
        outcome: "needs-review",
        state: cloneState(state),
        issues: [
          {
            type: "journal",
            mutationId: mutation.id,
            reason: applied.reason,
          },
        ],
      };
    }
    journalPreview = {
      inventory: applied.state.inventory as PantryItem[],
      journal: applied.state.journal as InventoryMutationRecord[],
    };
  }

  return {
    outcome: "recorded",
    state: {
      pantry: journalPreview.inventory,
      consumptionRecords: confirmed.state.consumptionRecords,
      inventoryJournal: journalPreview.journal,
    },
    record: confirmed.record,
    journalMutations,
  };
}
