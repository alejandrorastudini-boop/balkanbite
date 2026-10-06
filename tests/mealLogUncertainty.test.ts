import assert from "node:assert/strict";
import test from "node:test";
import { buildMealLogPreservingNutritionUncertainty } from "../src/utils/verifiedMealLog";

const base = {
  id: "meal-1",
  date: "2026-10-06",
  timestamp: "2026-10-06T12:00:00+03:00",
  mealType: "lunch",
  recipeId: "recipe-1",
  manualName: "Shopska salad",
};

test("meal identity survives when nutrition is not verified", () => {
  const meal = buildMealLogPreservingNutritionUncertainty({
    ...base,
    nutritionVerified: false,
    calories: 999,
    proteinG: 99,
    carbsG: 99,
    fatG: 99,
  });
  assert.deepEqual(meal, {
    ...base,
    nutritionDataStatus: "unknown",
  });
});

test("explicit verified nutrition must still be complete", () => {
  assert.equal(buildMealLogPreservingNutritionUncertainty({
    ...base,
    nutritionVerified: true,
    calories: 500,
    proteinG: 20,
    carbsG: 30,
  }), null);
});

test("complete explicitly verified nutrition remains verified", () => {
  const meal = buildMealLogPreservingNutritionUncertainty({
    ...base,
    nutritionVerified: true,
    calories: 500,
    proteinG: 20,
    carbsG: 30,
    fatG: 10,
  });
  assert.equal(meal?.nutritionDataStatus, "verified");
  assert.equal(meal?.calories, 500);
});
