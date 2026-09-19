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
