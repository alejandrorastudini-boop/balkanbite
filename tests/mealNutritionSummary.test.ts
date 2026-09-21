import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeVerifiedMealNutrition,
  verifiedMealCalories,
} from "../src/utils/mealNutritionSummary";
import type { MealLog } from "../src/types";

const log = (
  id: string,
  status: MealLog["nutritionDataStatus"],
  calories: number,
  proteinG = 10,
  carbsG = 20,
  fatG = 5,
): MealLog => ({
  id,
  date: "2026-09-19",
  mealType: "lunch",
  manualName: id,
  nutritionDataStatus: status,
  calories,
  proteinG,
  carbsG,
  fatG,
  timestamp: "fixture",
});

test("daily totals include only explicitly verified nutrition", () => {
  const result = summarizeVerifiedMealNutrition([
    log("verified", "verified", 400, 30, 50, 10),
    log("estimated", "estimated", 700, 40, 80, 20),
    log("unknown", "unknown", 0, 0, 0, 0),
  ]);

  assert.deepEqual(result, {
    totals: { calories: 400, protein: 30, carbs: 50, fat: 10 },
    verifiedLogCount: 1,
    unverifiedLogCount: 2,
  });
});

test("no verified logs means nutrition totals are unknown, not zero", () => {
  const result = summarizeVerifiedMealNutrition([
    log("unknown", "unknown", 0, 0, 0, 0),
    log("legacy", undefined, 500, 20, 50, 15),
  ]);

  assert.deepEqual(result, {
    totals: null,
    verifiedLogCount: 0,
    unverifiedLogCount: 2,
  });
});

test("invalid numeric data cannot enter totals even when status says verified", () => {
  const invalid = log("invalid", "verified", Number.NaN);
  const result = summarizeVerifiedMealNutrition([invalid]);

  assert.equal(result.totals, null);
  assert.equal(result.verifiedLogCount, 0);
  assert.equal(result.unverifiedLogCount, 1);
  assert.equal(verifiedMealCalories(invalid), null);
});

test("individual calorie display follows the same verified boundary", () => {
  assert.equal(verifiedMealCalories(log("ok", "verified", 123)), 123);
  assert.equal(verifiedMealCalories(log("estimated", "estimated", 123)), null);
  assert.equal(verifiedMealCalories(log("unknown", "unknown", 0)), null);
});


test("unknown meal history can omit nutrition fields entirely", () => {
  const unknown: MealLog = {
    id: "unknown-without-macros",
    date: "2026-09-19",
    mealType: "dinner",
    manualName: "Soup",
    nutritionDataStatus: "unknown",
    timestamp: "2026-09-19T19:00:00.000Z",
  };

  assert.deepEqual(summarizeVerifiedMealNutrition([unknown]), {
    totals: null,
    verifiedLogCount: 0,
    unverifiedLogCount: 1,
  });
  assert.equal(verifiedMealCalories(unknown), null);
});

test("verified status without all numeric fields cannot enter totals", () => {
  const incomplete: MealLog = {
    id: "verified-incomplete",
    date: "2026-09-19",
    mealType: "lunch",
    nutritionDataStatus: "verified",
    calories: 300,
    proteinG: 20,
    timestamp: "2026-09-19T12:00:00.000Z",
  };

  const summary = summarizeVerifiedMealNutrition([incomplete]);
  assert.equal(summary.totals, null);
  assert.equal(summary.verifiedLogCount, 0);
  assert.equal(summary.unverifiedLogCount, 1);
});
