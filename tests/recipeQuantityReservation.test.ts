import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe } from "../src/types";
import { calculateRecipePantryScore, syncRecipeWithPantry } from "../src/utils/menuAutoPlanner";

const pantry: PantryItem[] = [{
  id: "lentils",
  name: "Lentils",
  quantity: 500,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "2026-10-04",
}];
const recipe: Recipe = {
  id: "repeat",
  title: { en: "Repeat", bg: "Repeat", es: "Repeat" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1,
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  nutritionDataStatus: "unknown", costDataStatus: "unknown", tags: [],
  ingredients: [
    { name: "Lentils", amount: 400, unit: "g", inPantry: false },
    { name: "Lentils", amount: 400, unit: "g", inPantry: false },
  ],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

test("recipe readiness reserves stock once across repeated ingredients", () => {
  const synced = syncRecipeWithPantry(recipe, pantry);
  assert.deepEqual(synced.ingredients.map((item) => item.inPantry), [true, false]);
});

test("recipe score cannot reuse the same stock across repeated ingredients", () => {
  const score = calculateRecipePantryScore(recipe, pantry);
  assert.equal(score.matchPercentage, 50);
});


test("RecipeView derives availability through recipe-level reservation", async () => {
  const fs = await import("node:fs");
  const view = fs.readFileSync("src/components/RecipeView.tsx", "utf8");
  assert.match(view, /syncRecipeWithPantry\(recipe, pantry\)/);
  assert.doesNotMatch(view, /isIngredientQuantityAvailable/);
  assert.match(view, /recipeWithAvailability\(selectedRecipe\)/);
});


test("perishable bonus cannot reuse the same reserved stock across repeated ingredients", () => {
  const expiringPantry = [{
    ...pantry[0],
    addedAt: "2026-10-04",
    expiryDaysLeft: 2,
  }];
  const score = calculateRecipePantryScore(
    recipe,
    expiringPantry,
    new Date(2026, 9, 4, 12, 0, 0, 0),
  );
  assert.equal(score.matchPercentage, 50);
  assert.equal(score.perishableUsedCount, 1);
});
