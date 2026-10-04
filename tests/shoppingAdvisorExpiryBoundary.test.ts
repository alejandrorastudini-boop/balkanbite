import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, PantryItem, Recipe } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const recipe = {
  id: "review-meal",
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
const plan: MealPlanDay[] = [{ date: "2026-10-04", lunch: recipe }];
const stock = (overrides: Partial<PantryItem> = {}): PantryItem => ({
  id: "rice", name: "Rice", quantity: 150, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-01", ...overrides,
});

test("passed entered date requires review without creating a verified buy candidate", () => {
  const result = evaluateShoppingNeeds(
    [stock({ expiryDaysLeft: 1 })], plan, [], "en",
    new Date("2026-10-04T12:00:00Z"),
  );
  assert.equal(result.missingMealIngredients[0]?.availabilityStatus, "expiry-review");
  assert.equal(result.itemsToAddToShoppingList.length, 0);
  assert.match(result.headline.en, /expiry review/i);
});

test("soon diagnostic uses effective date and partial evidence stays non-exact", () => {
  const known = evaluateShoppingNeeds(
    [stock({ expiryDaysLeft: 5 })], [], [], "en",
    new Date("2026-10-04T12:00:00Z"),
  );
  const partial = evaluateShoppingNeeds(
    [stock({ expiryDaysLeft: 1, expiryIsPartial: true })], [], [], "en",
    new Date("2026-10-01T12:00:00Z"),
  );
  assert.equal(known.expiringPantryItems.length, 1);
  assert.equal(partial.expiringPantryItems.length, 0);
});
