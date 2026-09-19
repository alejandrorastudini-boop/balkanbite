import assert from "node:assert/strict";
import test from "node:test";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";
import type { MealPlanDay, Recipe } from "../src/types";

const recipe: Recipe = {
  id: "rice-meal",
  title: { en: "Rice meal", bg: "Ориз", es: "Arroz" },
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
  ingredients: [
    { name: "Rice", amount: 500, unit: "g", inPantry: false },
  ],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

const mealPlan: MealPlanDay[] = [
  { date: "fixture", lunch: recipe },
];

test("missing-meal diagnostics keep unavailable price unknown instead of zero", () => {
  const result = evaluateShoppingNeeds([], mealPlan, [], "en");

  assert.equal(result.missingMealIngredients.length, 1);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.missingMealIngredients[0],
      "estimatedPriceEUR",
    ),
    false,
  );

  assert.equal(result.itemsToAddToShoppingList.length, 1);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.itemsToAddToShoppingList[0],
      "estimatedPriceEUR",
    ),
    false,
  );
});
