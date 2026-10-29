import assert from "node:assert/strict";
import test from "node:test";
import type { Recipe, MealPlanDay, PantryItem, ShoppingItem } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const now = new Date(2026, 9, 20, 12);
const recipe: Recipe = {
  id: "qa-invalid-required", title: { en: "QA Food", es: "Comida QA", bg: "QA храна" },
  description: { en: "QA", es: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0, difficulty: "easy",
  servings: 1, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  tags: [], ingredients: [{ name: "QA Flour", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const plan = (amount: number, unit: string = "g"): MealPlanDay[] => [{
  date: "2026-10-20",
  lunch: {
    ...recipe, ingredients: [{ name: "QA Flour", amount, unit, inPantry: false }],
  },
}];
const flour = (quantity: number, unit: string): PantryItem => ({
  id: "flour", name: "QA Flour", quantity, unit,
  category: "Pantry/Grains", addedAt: "2026-10-20",
});

test("missing amount is review required, never a zero-quantity verified shortfall", () => {
  for (const amount of [NaN, Infinity, -Infinity, 0, -2]) {
    for (const pantry of [[], [flour(100, "g")]]) {
      const diagnostic = evaluateShoppingNeeds(pantry, plan(amount), [], "en", now);
      assert.equal(diagnostic.missingMealIngredients.length, 1, String(amount));
      assert.equal(diagnostic.missingMealIngredients[0]?.availabilityStatus,
        "unverified", String(amount));
      assert.equal(diagnostic.itemsToAddToShoppingList.length, 0,
        "cannot add a deterministic purchase amount from an invalid recipe");
      assert.doesNotMatch(diagnostic.headline.en, /quantitative shortfalls/i);
    }
  }
});

test("a finite but base-unit-overflowing required amount is not authoritative", () => {
  const diagnostic = evaluateShoppingNeeds([], plan(1e308, "kg"), [], "es", now);
  assert.equal(diagnostic.missingMealIngredients[0]?.availabilityStatus, "unverified");
  assert.deepEqual(diagnostic.itemsToAddToShoppingList, []);
  assert.equal(diagnostic.estimatedTotalTripEUR, undefined);
});

test("an overflowed pantry lot cannot falsely cover an ordinary recipe amount", () => {
  const diagnostic = evaluateShoppingNeeds([flour(1e308, "kg")], plan(100), [], "en", now);
  assert.equal(diagnostic.missingMealIngredients[0]?.availabilityStatus, "unverified");
  assert.deepEqual(diagnostic.itemsToAddToShoppingList, []);
});

test("overflowed pending shopping amount cannot hide a verified shortfall", () => {
  const extreme: ShoppingItem = {
    id: "huge-shopping", name: "QA Flour", quantity: 1e308, unit: "kg",
    checked: false, category: "Other", amountOrigin: "ai_estimated",
    purchaseAmountConfirmed: false,
  };
  const diagnostic = evaluateShoppingNeeds([], plan(100), [extreme], "en", now);
  assert.equal(diagnostic.missingMealIngredients[0]?.availabilityStatus, "missing");
  assert.equal(diagnostic.itemsToAddToShoppingList[0]?.quantity, 100);
  assert.equal(diagnostic.itemsToAddToShoppingList[0]?.unit, "g");
  assert.equal(diagnostic.itemsToAddToShoppingList[0]?.purchaseAmountConfirmed, false);
});

test("normal compatible quantities still calculate deterministic shortfalls", () => {
  const diagnostic = evaluateShoppingNeeds([flour(0.05, "kg")], plan(100), [], "bg", now);
  assert.equal(diagnostic.missingMealIngredients[0]?.availabilityStatus, "insufficient");
  assert.equal(diagnostic.missingMealIngredients[0]?.amount, 50);
  assert.equal(diagnostic.itemsToAddToShoppingList[0]?.quantity, 50);
});
