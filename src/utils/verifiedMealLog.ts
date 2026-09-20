import type { MealLog } from "../types";

const VALID_MEAL_TYPES = new Set<MealLog["mealType"]>([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

export interface VerifiedMealLogCandidate {
  id: unknown;
  date: unknown;
  timestamp: unknown;
  mealType: unknown;
  manualName?: unknown;
  recipeId?: unknown;
  nutritionVerified?: unknown;
  calories?: unknown;
  proteinG?: unknown;
  carbsG?: unknown;
  fatG?: unknown;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  );
}

function isIsoTimestampWithTimezone(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Converts only explicitly verified, complete nutrition into a MealLog.
 * Missing/invalid nutrition is rejected as a whole rather than defaulting
 * unknown values to zero.
 */
export function buildVerifiedMealLog(
  candidate: VerifiedMealLogCandidate,
): MealLog | null {
  if (
    candidate.nutritionVerified !== true ||
    typeof candidate.id !== "string" ||
    candidate.id.trim().length === 0 ||
    !isIsoDate(candidate.date) ||
    !isIsoTimestampWithTimezone(candidate.timestamp) ||
    typeof candidate.mealType !== "string" ||
    !VALID_MEAL_TYPES.has(candidate.mealType as MealLog["mealType"]) ||
    !isFiniteNonNegativeNumber(candidate.calories) ||
    !isFiniteNonNegativeNumber(candidate.proteinG) ||
    !isFiniteNonNegativeNumber(candidate.carbsG) ||
    !isFiniteNonNegativeNumber(candidate.fatG)
  ) {
    return null;
  }

  const manualName = cleanOptionalString(candidate.manualName);
  const recipeId = cleanOptionalString(candidate.recipeId);

  return {
    id: candidate.id.trim(),
    date: candidate.date,
    mealType: candidate.mealType as MealLog["mealType"],
    ...(recipeId ? { recipeId } : {}),
    ...(manualName ? { manualName } : {}),
    nutritionDataStatus: "verified",
    calories: candidate.calories,
    proteinG: candidate.proteinG,
    carbsG: candidate.carbsG,
    fatG: candidate.fatG,
    timestamp: candidate.timestamp,
  };
}
