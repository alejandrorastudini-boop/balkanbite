import type { MealLog } from "../types";

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyNutritionSummary {
  totals: NutritionTotals | null;
  verifiedLogCount: number;
  unverifiedLogCount: number;
}

type MealLogWithVerifiedNutrition = MealLog & {
  nutritionDataStatus: "verified";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function hasValidVerifiedNutrition(
  log: MealLog,
): log is MealLogWithVerifiedNutrition {
  return (
    log.nutritionDataStatus === "verified" &&
    [log.calories, log.proteinG, log.carbsG, log.fatG].every(
      (value) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0,
    )
  );
}

/**
 * Important daily totals include only explicitly verified nutrition.
 * Estimated, unknown, legacy, or numerically invalid logs remain recorded but
 * cannot silently enter authoritative daily totals.
 */
export function summarizeVerifiedMealNutrition(
  logs: readonly MealLog[],
): DailyNutritionSummary {
  const verified = logs.filter(hasValidVerifiedNutrition);
  const totals =
    verified.length === 0
      ? null
      : verified.reduce<NutritionTotals>(
          (acc, log) => ({
            calories: acc.calories + log.calories,
            protein: acc.protein + log.proteinG,
            carbs: acc.carbs + log.carbsG,
            fat: acc.fat + log.fatG,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );

  return {
    totals,
    verifiedLogCount: verified.length,
    unverifiedLogCount: logs.length - verified.length,
  };
}

export function verifiedMealCalories(log: MealLog): number | null {
  return hasValidVerifiedNutrition(log) ? log.calories : null;
}
