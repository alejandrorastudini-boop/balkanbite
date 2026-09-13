import assert from "node:assert/strict";
import { PantryItem, RecipeIngredient } from "../src/types";
import { deductRecipeIngredientsFromPantry } from "../src/utils/pantryConsumption";

const item = (
  id: string,
  name: string,
  quantity: number,
  unit: string,
  expiryDaysLeft?: number
): PantryItem => ({
  id,
  name,
  quantity,
  unit,
  category: "Pantry/Grains",
  expiryDaysLeft,
  addedAt: "2026-09-13",
});

const ingredient = (
  name: string,
  amount: number,
  unit: string
): RecipeIngredient => ({ name, amount, unit, inPantry: true });

const mixedUnits = deductRecipeIngredientsFromPantry(
  [
    item("kg", "Lentejas", 0.5, "kg", 2),
    item("g", "Lentejas", 300, "g", 5),
  ],
  [ingredient("Lentejas", 600, "g")]
);
assert.equal(mixedUnits.issues.length, 0);
assert.equal(mixedUnits.deductions.length, 2);
assert.equal(mixedUnits.pantry.length, 1);
assert.equal(mixedUnits.pantry[0].id, "g");
assert.equal(mixedUnits.pantry[0].quantity, 200);

const countAliases = deductRecipeIngredientsFromPantry(
  [item("eggs", "Huevos frescos", 6, "uds")],
  [ingredient("Huevos frescos", 2, "ud")]
);
assert.equal(countAliases.issues.length, 0);
assert.equal(countAliases.pantry[0].quantity, 4);

const incompatible = deductRecipeIngredientsFromPantry(
  [item("lentils", "Lentejas", 1, "paquete")],
  [ingredient("Lentejas", 200, "g")]
);
assert.equal(incompatible.issues.length, 1);
assert.equal(incompatible.issues[0].reason, "incompatible_unit");
assert.equal(incompatible.deductions.length, 0);
assert.equal(incompatible.pantry[0].quantity, 1);
assert.equal(incompatible.pantry[0].unit, "paquete");

const insufficient = deductRecipeIngredientsFromPantry(
  [item("lentils", "Lentejas", 320, "g")],
  [ingredient("Lentejas", 500, "g")]
);
assert.equal(insufficient.issues.length, 1);
assert.equal(insufficient.issues[0].reason, "insufficient_quantity");
assert.equal(insufficient.deductions.length, 0);
assert.equal(insufficient.pantry[0].quantity, 320);

const expiryFirst = deductRecipeIngredientsFromPantry(
  [
    item("later", "Arroz", 300, "g", 10),
    item("sooner", "Arroz", 300, "g", 1),
  ],
  [ingredient("Arroz", 250, "g")]
);
assert.equal(expiryFirst.issues.length, 0);
assert.equal(expiryFirst.deductions.length, 1);
assert.equal(expiryFirst.deductions[0].pantryItemId, "sooner");
assert.equal(expiryFirst.pantry.find((p) => p.id === "sooner")?.quantity, 50);
assert.equal(expiryFirst.pantry.find((p) => p.id === "later")?.quantity, 300);

console.log("unit-safe pantry consumption verification: PASS");
