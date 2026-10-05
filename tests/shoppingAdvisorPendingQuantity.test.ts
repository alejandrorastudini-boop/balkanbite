import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, Recipe, ShoppingItem } from "../src/types";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const recipe = {
  id: "quantity-meal",
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
const fixedNow = new Date(2026, 9, 4, 12, 0, 0, 0);
const pending = (id: string, quantity: number, unit: string, checked = false): ShoppingItem => ({
  id, name: "Milk", quantity, unit, category: "Dairy", checked,
});

test("partial pending quantity leaves only the remaining shortfall", () => {
  const result = evaluateShoppingNeeds([], plan, [pending("a", 0.5, "l")], "en", fixedNow);
  assert.equal(result.itemsToAddToShoppingList[0]?.quantity, 0.5);
  assert.equal(result.itemsToAddToShoppingList[0]?.unit, "l");
});

test("compatible pending quantities aggregate across rows", () => {
  const result = evaluateShoppingNeeds(
    [], plan, [pending("a", 250, "ml"), pending("b", 0.75, "l")], "en", fixedNow,
  );
  assert.equal(result.itemsToAddToShoppingList.length, 0);
});

test("checked or incompatible pending rows do not hide a shortfall", () => {
  const result = evaluateShoppingNeeds(
    [], plan, [pending("a", 1, "l", true), pending("b", 1, "pcs")], "en", fixedNow,
  );
  assert.equal(result.itemsToAddToShoppingList[0]?.quantity, 1);
});


test("equivalent normalized ingredient names aggregate into one candidate", () => {
  const secondRecipe = {
    ...recipe,
    id: "quantity-meal-2",
    ingredients: [{ name: "  MILK  ", amount: 1, unit: "l", inPantry: false }],
  };
  const result = evaluateShoppingNeeds(
    [],
    [{ date: "2026-10-04", breakfast: recipe, lunch: secondRecipe }],
    [],
    "en",
    fixedNow,
  );
  assert.equal(result.itemsToAddToShoppingList.length, 1);
  assert.equal(result.itemsToAddToShoppingList[0]?.quantity, 2);
});


test("one pending quantity cannot be reused to cover multiple planned meals", () => {
  const secondDay: MealPlanDay = { date: "2026-10-05", breakfast: recipe };
  const result = evaluateShoppingNeeds(
    [],
    [plan[0], secondDay],
    [pending("a", 1, "l")],
    "en",
    new Date(2026, 9, 4, 12, 0, 0, 0),
  );
  assert.equal(result.itemsToAddToShoppingList.length, 1);
  assert.equal(result.itemsToAddToShoppingList[0]?.quantity, 1);
});


test("verified advisor shortfalls carry deterministic provenance but are not purchase-confirmed", () => {
  const result = evaluateShoppingNeeds(
    [],
    plan,
    [],
    "en",
    new Date(2026, 9, 4, 12, 0, 0, 0),
  );
  const item = result.itemsToAddToShoppingList[0];
  assert.equal(item?.amountOrigin, "deterministic_shortfall");
  assert.equal(item?.purchaseAmountConfirmed, false);
  assert.equal(item?.estimatedPriceEUR, undefined);
});


test("managed derived shortage rows do not cancel their own target", () => {
  const managed: ShoppingItem = {
    id: "shortage-v1:abc", name: "Milk", quantity: 1, unit: "l", category: "Dairy",
    checked: false, amountOrigin: "deterministic_shortfall", purchaseAmountConfirmed: false,
  };
  const result = evaluateShoppingNeeds([], plan, [managed], "en", fixedNow);
  assert.equal(result.itemsToAddToShoppingList.length, 1);
  assert.equal(result.itemsToAddToShoppingList[0]?.quantity, 1);
});
