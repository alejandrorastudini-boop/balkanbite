import type { MealLog } from "../types";
import {
  summarizeVerifiedMealNutrition,
  type NutritionTotals,
} from "./mealNutritionSummary";

export interface WeeklyNutritionEvidence {
  startDate: string;
  endDate: string;
  totals: NutritionTotals | null;
  verifiedLogCount: number;
  unverifiedLogCount: number;
  daysWithVerifiedNutrition: number;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3] + deltaDays));
  return date.toISOString().slice(0, 10);
}

/**
 * Seven local-calendar days ending on endDate. This is an evidence summary,
 * not a nutrition target or adherence score.
 */
export function summarizeSevenDayNutritionEvidence(
  logs: readonly MealLog[],
  endDate: string,
): WeeklyNutritionEvidence {
  const startDate = shiftIsoDate(endDate, -6);
  const inWindow = logs.filter((log) => log.date >= startDate && log.date <= endDate);
  const summary = summarizeVerifiedMealNutrition(inWindow);
  const verifiedDates = new Set<string>();

  for (const log of inWindow) {
    const one = summarizeVerifiedMealNutrition([log]);
    if (one.verifiedLogCount === 1) verifiedDates.add(log.date);
  }

  return {
    startDate,
    endDate,
    totals: summary.totals,
    verifiedLogCount: summary.verifiedLogCount,
    unverifiedLogCount: summary.unverifiedLogCount,
    daysWithVerifiedNutrition: verifiedDates.size,
  };
}
