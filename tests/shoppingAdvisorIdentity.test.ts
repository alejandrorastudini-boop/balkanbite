import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, Recipe, ShoppingItem } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const recipe = {
  id: "identity-meal",
  title: { en: "Milk meal", bg: "Мляко", es: "Leche" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1,
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  nutritionDataStatus: "unknown", costDataStatus: "unknown", tags: [],
  ingredients: [{ name: "Milk", amount: 1, unit: "l", inPantry: false }],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
} as Recipe;
const plan: MealPlanDay[] = [{ date: "2026-10-04", breakfast: recipe }];

const pending = (name: string): ShoppingItem => ({
  id: "pending",
  name,
  quantity: 1,
  unit: "l",
  category: "Dairy",
  checked: false,
});

test("qualified pending product does not hide a different meal-plan shortfall", () => {
  const result = evaluateShoppingNeeds([], plan, [pending("Almond milk")], "en");
  assert.equal(result.itemsToAddToShoppingList.length, 1);
  assert.equal(result.itemsToAddToShoppingList[0]?.name, "Milk");
});

test("case and whitespace normalized exact identity prevents duplicate suggestion", () => {
  const result = evaluateShoppingNeeds([], plan, [pending("  MILK  ")], "en");
  assert.equal(result.itemsToAddToShoppingList.length, 0);
});
