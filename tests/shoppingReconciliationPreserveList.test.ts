import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("unselected shopping rows remain untouched", () => {
  const shopping = [
    { id: "a", name: "Leche", quantity: 1, unit: "L", category: "Dairy", estimatedPriceEUR: 0, checked: false },
    { id: "b", name: "Pan", quantity: 1, unit: "pack", category: "Pantry/Grains", estimatedPriceEUR: 0, checked: false },
  ];
  const result = reconcileConfirmedShoppingPurchases([], shopping, ["a"], [], "2026-09-13", "preserve-list");
  assert.equal(result.shoppingList.length, 1);
  assert.equal(result.shoppingList[0].id, "b");
});
