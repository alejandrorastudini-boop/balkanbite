import assert from "node:assert/strict";
import test from "node:test";
import {
  deductRecipeIngredientsFromPantry,
  deductVoiceItemsFromPantry,
} from "../src/utils/pantryConsumption";
import type { PantryItem, RecipeIngredient } from "../src/types";

const pantry: PantryItem[] = [
  {
    id: "rice",
    name: "Rice",
    quantity: 200,
    unit: "g",
    category: "Pantry/Grains",
    addedAt: "fixture",
  },
  {
    id: "oil",
    name: "Oil",
    quantity: 50,
    unit: "ml",
    category: "Pantry/Grains",
    addedAt: "fixture",
  },
];

test("recipe consumption rolls back every deduction when one ingredient is unresolved", () => {
  const ingredients: RecipeIngredient[] = [
    { name: "Rice", amount: 100, unit: "g", inPantry: true },
    { name: "Oil", amount: 100, unit: "ml", inPantry: true },
  ];

  const result = deductRecipeIngredientsFromPantry(pantry, ingredients);

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].ingredientName, "Oil");
  assert.equal(result.issues[0].reason, "insufficient_quantity");
  assert.deepEqual(result.pantry, pantry);
  assert.deepEqual(result.deductions, []);
});

test("recipe consumption commits all deductions when every ingredient is safe", () => {
  const ingredients: RecipeIngredient[] = [
    { name: "Rice", amount: 100, unit: "g", inPantry: true },
    { name: "Oil", amount: 25, unit: "ml", inPantry: true },
  ];

  const result = deductRecipeIngredientsFromPantry(pantry, ingredients);

  assert.deepEqual(result.issues, []);
  assert.equal(result.deductions.length, 2);
  assert.deepEqual(
    result.pantry.map((item) => ({ id: item.id, quantity: item.quantity, unit: item.unit })),
    [
      { id: "rice", quantity: 100, unit: "g" },
      { id: "oil", quantity: 25, unit: "ml" },
    ],
  );
});

test("voice multi-item removal also rolls back on an unsafe item", () => {
  const result = deductVoiceItemsFromPantry(pantry, [
    { name: "Rice", quantity: 100, unit: "g" },
    { name: "Oil", quantity: undefined, unit: "ml" },
  ]);

  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.pantry, pantry);
  assert.deepEqual(result.deductions, []);
});


test("automatic recipe deduction stops for stock that needs expiry review", () => {
  const reviewPantry: PantryItem[] = [
    {
      id: "rice-review",
      name: "Rice",
      quantity: 200,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-10-01",
      expiryDaysLeft: 1,
    },
  ];

  const result = deductRecipeIngredientsFromPantry(
    reviewPantry,
    [{ name: "Rice", amount: 100, unit: "g", inPantry: true }],
    new Date("2026-10-04T12:00:00.000Z"),
  );

  assert.equal(result.issues[0]?.reason, "expiry_review_required");
  assert.deepEqual(result.pantry, reviewPantry);
  assert.deepEqual(result.deductions, []);
});

test("partial merged stock also stops automatic deduction pending review", () => {
  const reviewPantry: PantryItem[] = [
    {
      id: "rice-partial",
      name: "Rice",
      quantity: 200,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-10-01",
      expiryDaysLeft: 5,
      expiryIsPartial: true,
    },
  ];

  const result = deductRecipeIngredientsFromPantry(
    reviewPantry,
    [{ name: "Rice", amount: 100, unit: "g", inPantry: true }],
    new Date("2026-10-02T12:00:00.000Z"),
  );

  assert.equal(result.issues[0]?.reason, "expiry_review_required");
  assert.deepEqual(result.deductions, []);
});


test("automatic deduction orders usable stock by effective expiry, not stale captured days", () => {
  const datedPantry: PantryItem[] = [
    {
      id: "rice-newer",
      name: "Rice",
      quantity: 100,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-10-04",
      expiryDaysLeft: 2,
    },
    {
      id: "rice-older",
      name: "Rice",
      quantity: 100,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-09-30",
      expiryDaysLeft: 5,
    },
  ];

  const result = deductRecipeIngredientsFromPantry(
    datedPantry,
    [{ name: "Rice", amount: 50, unit: "g", inPantry: true }],
    new Date("2026-10-04T12:00:00.000Z"),
  );

  assert.deepEqual(result.issues, []);
  assert.equal(result.deductions[0]?.pantryItemId, "rice-older");
});


test("review stock that would complete an otherwise short requirement reports review, not simple shortage", () => {
  const mixedPantry: PantryItem[] = [
    {
      id: "rice-ok",
      name: "Rice",
      quantity: 50,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-10-04",
    },
    {
      id: "rice-review",
      name: "Rice",
      quantity: 100,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-10-01",
      expiryDaysLeft: 1,
    },
  ];

  const result = deductRecipeIngredientsFromPantry(
    mixedPantry,
    [{ name: "Rice", amount: 100, unit: "g", inPantry: true }],
    new Date("2026-10-04T12:00:00.000Z"),
  );

  assert.equal(result.issues[0]?.reason, "expiry_review_required");
  assert.deepEqual(result.deductions, []);
  assert.deepEqual(result.pantry, mixedPantry);
});
