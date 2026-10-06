import assert from "node:assert/strict";
import test from "node:test";
import type { MealLog } from "../src/types";
import { summarizeVerifiedNutritionForDate } from "../src/utils/verifiedNutritionSummary";

const verified = (id: string, date = "2026-10-06"): MealLog => ({
  id,
  date,
  mealType: "lunch",
  nutritionDataStatus: "verified",
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  timestamp: date + "T12:00:00+03:00",
});

test("sums only complete verified nutrition for the requested local date", () => {
  const result = summarizeVerifiedNutritionForDate([
    verified("a"),
    { ...verified("b"), calories: 250, proteinG: 10, carbsG: 20, fatG: 5 },
    verified("tomorrow", "2026-10-07"),
  ], "2026-10-06");
  assert.deepEqual(result, {
    calories: 750,
    proteinG: 40,
    carbsG: 80,
    fatG: 20,
    verifiedMealCount: 2,
    excludedMealCount: 0,
  });
});

test("estimated unknown and incomplete nutrition never become authoritative zeroes", () => {
  const result = summarizeVerifiedNutritionForDate([
    { ...verified("estimated"), nutritionDataStatus: "estimated" },
    { ...verified("unknown"), nutritionDataStatus: "unknown" },
    { ...verified("incomplete"), fatG: undefined },
  ], "2026-10-06");
  assert.deepEqual(result, {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    verifiedMealCount: 0,
    excludedMealCount: 3,
  });
});

test("verified zero values remain valid known nutrition", () => {
  const result = summarizeVerifiedNutritionForDate([
    { ...verified("zero"), calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  ], "2026-10-06");
  assert.equal(result.verifiedMealCount, 1);
  assert.equal(result.excludedMealCount, 0);
  assert.equal(result.calories, 0);
});
