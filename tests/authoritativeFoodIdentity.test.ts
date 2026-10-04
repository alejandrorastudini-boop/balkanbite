import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe } from "../src/types";
import { deductRecipeIngredientsFromPantry } from "../src/utils/pantryConsumption";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";
import { buildRecipeShoppingNeeds } from "../src/utils/recipeShoppingNeeds";

const stock: PantryItem = {
  id: "red-pepper",
  name: "Red pepper",
  quantity: 200,
  unit: "g",
  category: "Produce",
  addedAt: "2026-10-04",
};
const recipe: Recipe = {
  id: "pepper-recipe",
  title: { en: "Pepper", bg: "Пипер", es: "Pimienta" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1,
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  nutritionDataStatus: "unknown", costDataStatus: "unknown", tags: [],
  ingredients: [{ name: "Pepper", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

test("qualified pantry product cannot satisfy generic recipe quantity authoritatively", () => {
  const [synced] = syncRecipesWithPantry([recipe], [stock]);
  assert.equal(synced.ingredients[0]?.inPantry, false);
});

test("qualified pantry product cannot be deducted for a generic ingredient", () => {
  const result = deductRecipeIngredientsFromPantry([stock], recipe.ingredients);
  assert.equal(result.issues[0]?.reason, "no_matching_item");
  assert.deepEqual(result.deductions, []);
  assert.deepEqual(result.pantry, [stock]);
});

test("qualified pantry product cannot hide deterministic recipe shopping need", () => {
  const result = buildRecipeShoppingNeeds(recipe, [stock]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.quantity, 100);
});
