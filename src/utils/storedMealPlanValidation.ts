import type { MealPlanDay } from "../types";
import { isStoredRecipeStructurallyValid } from "./storedRecipeValidation";

function isStrictIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function isValidOptionalMeal(value: unknown): boolean {
  return value === undefined || isStoredRecipeStructurallyValid(value);
}

/**
 * Non-destructive structural boundary for persisted meal-plan days.
 *
 * A day is accepted only when its date is a real YYYY-MM-DD calendar date and
 * every present meal is already a structurally valid stored Recipe. Missing
 * meals remain missing; no recipe, date, or nutrition data is fabricated.
 */
export function isStoredMealPlanDayStructurallyValid(
  value: unknown,
): value is MealPlanDay {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isStrictIsoCalendarDate(record.date) &&
    isValidOptionalMeal(record.breakfast) &&
    isValidOptionalMeal(record.lunch) &&
    isValidOptionalMeal(record.dinner)
  );
}

/**
 * Parses persisted meal-plan arrays while quarantining malformed days.
 * Valid day objects are returned exactly as stored.
 */
export function parseStoredMealPlanCache(
  raw: string | null,
): MealPlanDay[] | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(isStoredMealPlanDayStructurallyValid);
  } catch {
    return null;
  }
}
