import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, Recipe } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const recipe = {
  id: "dst-meal",
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

test("calendar offsets use date components rather than elapsed 24-hour periods", () => {
  const plan: MealPlanDay[] = [
    { date: "2026-10-25", lunch: recipe },
    { date: "2026-10-26", lunch: recipe },
  ];
  const result = evaluateShoppingNeeds(
    [], plan, [], "en", new Date(2026, 9, 24, 12, 0, 0, 0),
  );
  assert.deepEqual(
    result.missingMealIngredients.map((item) => item.dayLabel),
    ["Tomorrow", "In 2 days"],
  );
});
