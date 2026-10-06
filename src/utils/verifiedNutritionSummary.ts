import type { MealLog } from "../types";

export interface VerifiedNutritionSummary {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  verifiedMealCount: number;
  excludedMealCount: number;
}

const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function hasCompleteVerifiedNutrition(
  log: MealLog,
): log is MealLog & Required<Pick<MealLog, "calories" | "proteinG" | "carbsG" | "fatG">> {
  return (
    log.nutritionDataStatus === "verified" &&
    finiteNonnegative(log.calories) &&
    finiteNonnegative(log.proteinG) &&
    finiteNonnegative(log.carbsG) &&
    finiteNonnegative(log.fatG)
  );
}

/**
 * Sums only complete nutrition records explicitly marked verified for the
 * requested local calendar date. Estimated/unknown/incomplete records remain
 * visible through excludedMealCount and never become zero-valued nutrition.
 */
export function summarizeVerifiedNutritionForDate(
  mealLogs: readonly MealLog[],
  localDate: string,
): VerifiedNutritionSummary {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let verifiedMealCount = 0;
  let excludedMealCount = 0;

  for (const log of mealLogs) {
    if (log.date !== localDate) continue;
    if (!hasCompleteVerifiedNutrition(log)) {
      excludedMealCount += 1;
      continue;
    }
    verifiedMealCount += 1;
    calories += log.calories;
    proteinG += log.proteinG;
    carbsG += log.carbsG;
    fatG += log.fatG;
  }

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    verifiedMealCount,
    excludedMealCount,
  };
}
