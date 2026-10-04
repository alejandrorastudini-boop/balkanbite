import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, Recipe } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const recipe = {
  id: "date-meal",
  title: { en: "Rice", bg: "Ориз", es: "Arroz" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1,
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  nutritionDataStatus: "unknown", costDataStatus: "unknown", tags: [],
  ingredients: [{ name: "Rice", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
} as Recipe;
const day = (date: string): MealPlanDay => ({ date, lunch: recipe });
const now = new Date(2026, 9, 4, 12, 0, 0, 0);

test("plan beginning tomorrow is not mislabeled as today's shortage", () => {
  const result = evaluateShoppingNeeds([], [day("2026-10-05")], [], "en", now);
  assert.equal(result.missingMealIngredients[0]?.dayLabel, "Tomorrow");
  assert.doesNotMatch(result.headline.en, /today/i);
});

test("past plan days are excluded from upcoming shopping urgency", () => {
  const result = evaluateShoppingNeeds(
    [], [day("2026-10-03"), day("2026-10-04")], [], "en", now,
  );
  assert.equal(result.missingMealIngredients.length, 1);
  assert.equal(result.missingMealIngredients[0]?.date, "2026-10-04");
  assert.equal(result.missingMealIngredients[0]?.dayLabel, "Today");
});

test("out-of-order plan is evaluated by actual local date", () => {
  const result = evaluateShoppingNeeds(
    [], [day("2026-10-06"), day("2026-10-04"), day("2026-10-05")], [], "en", now,
  );
  assert.deepEqual(
    result.missingMealIngredients.map((item) => item.date),
    ["2026-10-04", "2026-10-05", "2026-10-06"],
  );
});

test("invalid calendar date cannot create an urgent shopping claim", () => {
  const result = evaluateShoppingNeeds([], [day("2026-02-30")], [], "en", now);
  assert.equal(result.missingMealIngredients.length, 0);
});
