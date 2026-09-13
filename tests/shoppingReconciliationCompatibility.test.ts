import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";
import type { PantryItem, ShoppingItem } from "../src/types";

const existing: PantryItem[] = [
  {
    id: "rice",
    name: "Arroz",
    quantity: 500,
    unit: "g",
    category: "Pantry/Grains",
    addedAt: "2026-09-01",
  },
];

test("reconciled compatible units merge while incompatible units remain separate", () => {
  const shopping: ShoppingItem[] = [
    { id: "kg", name: "Arroz", quantity: 0.5, unit: "kg", category: "Pantry/Grains", estimatedPriceEUR: 0, checked: false },
    { id: "pack", name: "Arroz", quantity: 1, unit: "pack", category: "Pantry/Grains", estimatedPriceEUR: 0, checked: false },
  ];

  const result = reconcileConfirmedShoppingPurchases(
    existing,
    shopping,
    ["kg", "pack"],
    [],
    "2026-09-13",
    "compatibility"
  );

  const gramRows = result.pantry.filter((item) => item.name === "Arroz" && item.unit === "g");
  const packRows = result.pantry.filter((item) => item.name === "Arroz" && item.unit === "pack");
  assert.equal(gramRows.length, 1);
  assert.equal(gramRows[0].quantity, 1000);
  assert.equal(packRows.length, 1);
  assert.equal(packRows[0].quantity, 1);
  assert.equal(result.shoppingList.length, 0);
});
