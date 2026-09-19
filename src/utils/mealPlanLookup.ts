import type { MealPlanDay } from "../types";

/**
 * Returns only an explicitly persisted/planned day.
 * Recipes existing in the catalog are not evidence that the user planned them.
 */
export function findPlannedMealForDate(
  mealPlan: readonly MealPlanDay[],
  date: string,
): MealPlanDay | null {
  if (typeof date !== "string" || !date.trim()) return null;
  return mealPlan.find((day) => day.date === date) ?? null;
}
