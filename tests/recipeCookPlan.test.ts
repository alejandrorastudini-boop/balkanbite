import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe } from "../src/types";
import { prepareRecipeCookPlan } from "../src/utils/recipeCookPlan";

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: "rec-test",
  title: { en: "Rice", bg: "Ориз", es: "Arroz" },
  description: { en: "Test", bg: "Тест", es: "Prueba" },
  prepTimeMin: 1,
  cookTimeMin: 1,
  costPerServingEUR: 1,
  difficulty: "easy",
  servings: 1,
  calories: 100,
  proteinG: 1,
  carbsG: 20,
  fatG: 1,
  fiberG: 1,
  tags: [],
  ingredients: [{ name: "Rice", amount: 150, unit: "g", inPantry: true }],
  instructions: { en: ["Cook"], bg: ["Готви"], es: ["Cocina"] },
  nutritionHighlights: { en: "Test", bg: "Тест", es: "Prueba" },
  ...overrides,
});

const lot = (
  id: string,
  quantity: number,
  unit: string,
  expiryDaysLeft?: number,
): PantryItem => ({
  id,
  name: "Rice",
  quantity,
  unit,
  category: "Pantry/Grains",
  addedAt: "2026-09-29",
  ...(expiryDaysLeft === undefined ? {} : { expiryDaysLeft }),
});

test("prepares deterministic expiry-first multi-lot cook allocations", () => {
  const result = prepareRecipeCookPlan(recipe(), [
    lot("newer", 100, "g", 10),
    lot("older", 100, "g", 2),
  ], "cook-123");
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") return;

  assert.deepEqual(result.plan.confirmation, {
    cookConfirmationId: "cook-123",
    mealId: "rec-test",
    confirmed: true,
    ingredients: [
      {
        ingredientId: "allocation-1",
        pantryItemId: "older",
        quantity: 100,
        unit: "g",
      },
      {
        ingredientId: "allocation-2",
        pantryItemId: "newer",
        quantity: 50,
        unit: "g",
      },
    ],
  });
  assert.deepEqual(result.plan.expectedRemaining, {
    older: null,
    newer: 50,
  });
  assert.deepEqual(
    result.plan.result.pantry.map(item => [item.id, item.quantity]),
    [["newer", 50]],
  );
});

test("purchase-provenance pantry IDs remain valid cook allocations", () => {
  const result = prepareRecipeCookPlan(
    recipe({
      id: "ai recipe:milk soup",
      ingredients: [{ name: "Milk", amount: 0.25, unit: "L", inPantry: true }],
    }),
    [{
      id: "purchase-shopping:s2",
      name: "Milk",
      quantity: 1,
      unit: "L",
      category: "Dairy",
      addedAt: "2026-09-29",
    }],
    "cook-purchased-1",
  );
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") return;
  assert.equal(
    result.plan.confirmation.ingredients[0].pantryItemId,
    "purchase-shopping:s2",
  );
  assert.equal(result.plan.confirmation.mealId, "ai recipe:milk soup");
  assert.equal(
    result.plan.expectedRemaining["purchase-shopping:s2"],
    0.75,
  );
});

test("insufficient or incompatible recipe never produces partial allocations", () => {
  for (const pantry of [
    [lot("short", 100, "g")],
    [lot("wrong-unit", 1, "L")],
  ]) {
    const result = prepareRecipeCookPlan(recipe(), pantry, "cook-nope");
    assert.equal(result.outcome, "needs-review");
    if (result.outcome === "needs-review") {
      assert.ok(result.issueCount >= 1);
    }
  }
});

test("invalid confirmation or meal identity fails closed", () => {
  assert.deepEqual(
    prepareRecipeCookPlan(recipe(), [lot("rice", 200, "g")], "bad:id"),
    { outcome: "needs-review", issueCount: 1 },
  );
  assert.deepEqual(
    prepareRecipeCookPlan(
      recipe({ id: " bad " }),
      [lot("rice", 200, "g")],
      "cook-good",
    ),
    { outcome: "needs-review", issueCount: 1 },
  );
});
