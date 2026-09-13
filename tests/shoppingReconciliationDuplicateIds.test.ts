import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("duplicate selected shopping ids are de-duplicated", () => {
  const shopping = [{ id: "x", name: "Leche", quantity: 1, unit: "L", category: "Dairy", estimatedPriceEUR: 0, checked: false }];
  const result = reconcileConfirmedShoppingPurchases([], shopping, ["x", "x"], [], "2026-09-13", "dupe-list");
  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].quantity, 1);
  assert.equal(result.shoppingList.length, 0);
});
