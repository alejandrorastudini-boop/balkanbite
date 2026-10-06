import type { MealLog, MealPlanDay } from "../types";

export type PlannedMealSlot = "breakfast" | "lunch" | "dinner";
export type PlannedMealConsumptionStatus =
  | "not_planned"
  | "planned_unconfirmed"
  | "planned_recipe_logged"
  | "planned_slot_logged_other";

export interface PlannedMealConsumption {
  slot: PlannedMealSlot;
  plannedRecipeId: string | null;
  status: PlannedMealConsumptionStatus;
  matchingLogId: string | null;
}

/**
 * Compares a planned slot with user meal-log evidence.
 * A matching recipeId proves that the planned recipe was logged.
 * A same-slot log with another/unknown recipe only proves that something was
 * logged for that slot; it must never be presented as adherence to the plan.
 */
export function derivePlannedMealConsumption(
  day: MealPlanDay | null | undefined,
  logs: readonly MealLog[],
  slot: PlannedMealSlot,
): PlannedMealConsumption {
  const recipe = day?.[slot];
  if (!recipe) {
    return { slot, plannedRecipeId: null, status: "not_planned", matchingLogId: null };
  }

  const sameDateSlotLogs = logs.filter(
    (log) => log.date === day.date && log.mealType === slot,
  );
  const exact = sameDateSlotLogs.find((log) => log.recipeId === recipe.id);
  if (exact) {
    return {
      slot,
      plannedRecipeId: recipe.id,
      status: "planned_recipe_logged",
      matchingLogId: exact.id,
    };
  }

  if (sameDateSlotLogs.length > 0) {
    return {
      slot,
      plannedRecipeId: recipe.id,
      status: "planned_slot_logged_other",
      matchingLogId: sameDateSlotLogs[0].id,
    };
  }

  return {
    slot,
    plannedRecipeId: recipe.id,
    status: "planned_unconfirmed",
    matchingLogId: null,
  };
}


export interface PlannedDayConsumptionSummary {
  plannedCount: number;
  loggedAsPlannedCount: number;
  differentMealLoggedCount: number;
  unconfirmedCount: number;
}

export function summarizePlannedDayConsumption(
  day: MealPlanDay | null | undefined,
  logs: readonly MealLog[],
): PlannedDayConsumptionSummary {
  const slots: PlannedMealSlot[] = ["breakfast", "lunch", "dinner"];
  const states = slots.map((slot) => derivePlannedMealConsumption(day, logs, slot));
  return {
    plannedCount: states.filter((state) => state.status !== "not_planned").length,
    loggedAsPlannedCount: states.filter((state) => state.status === "planned_recipe_logged").length,
    differentMealLoggedCount: states.filter((state) => state.status === "planned_slot_logged_other").length,
    unconfirmedCount: states.filter((state) => state.status === "planned_unconfirmed").length,
  };
}
