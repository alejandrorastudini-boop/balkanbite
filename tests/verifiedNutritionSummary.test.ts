import assert from "node:assert/strict";
import test from "node:test";
import type { MealLog } from "../src/types";
import { summarizeVerifiedMealNutritionForDate } from "../src/utils/mealNutritionSummary";

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
  const result = summarizeVerifiedMealNutritionForDate([
    verified("a"),
    { ...verified("b"), calories: 250, proteinG: 10, carbsG: 20, fatG: 5 },
    verified("tomorrow", "2026-10-07"),
  ], "2026-10-06");
  assert.deepEqual(result, {
    totals: { calories: 750, protein: 40, carbs: 80, fat: 20 },
    verifiedLogCount: 2,
    unverifiedLogCount: 0,
  });
});

test("estimated unknown and incomplete nutrition never become authoritative zeroes", () => {
  const result = summarizeVerifiedMealNutritionForDate([
    { ...verified("estimated"), nutritionDataStatus: "estimated" },
    { ...verified("unknown"), nutritionDataStatus: "unknown" },
    { ...verified("incomplete"), fatG: undefined },
  ], "2026-10-06");
  assert.deepEqual(result, {
    totals: null,
    verifiedLogCount: 0,
    unverifiedLogCount: 3,
  });
});

test("verified zero values remain valid known nutrition", () => {
  const result = summarizeVerifiedMealNutritionForDate([
    { ...verified("zero"), calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  ], "2026-10-06");
  assert.equal(result.verifiedLogCount, 1);
  assert.equal(result.unverifiedLogCount, 0);
  assert.equal(result.totals?.calories, 0);
});
