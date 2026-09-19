import assert from "node:assert/strict";
import test from "node:test";
import { findPlannedMealForDate } from "../src/utils/mealPlanLookup";
import type { MealPlanDay, Recipe } from "../src/types";

const recipe: Recipe = {
  id: "planned-recipe",
  title: { en: "Planned", bg: "Планирано", es: "Planificado" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0,
  cookTimeMin: 0,
  costPerServingEUR: 0,
  difficulty: "easy",
  servings: 1,
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  tags: [],
  ingredients: [],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

const plan: MealPlanDay[] = [
  { date: "2026-09-20", lunch: recipe },
];

test("returns an explicitly planned day", () => {
  assert.deepEqual(findPlannedMealForDate(plan, "2026-09-20"), plan[0]);
});

test("does not fabricate a meal for an unplanned date", () => {
  assert.equal(findPlannedMealForDate(plan, "2026-09-21"), null);
  assert.equal(findPlannedMealForDate([], "2026-09-20"), null);
});

test("invalid date input stays unresolved", () => {
  assert.equal(findPlannedMealForDate(plan, ""), null);
  assert.equal(findPlannedMealForDate(plan, "   "), null);
});
