import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("empty confirmed reconciliation leaves all state untouched", () => {
  const pantry = [{ id: "x", name: "Huevos", quantity: 6, unit: "uds", category: "Dairy" as const, addedAt: "2026-09-01" }];
  const shopping = [{ id: "y", name: "Leche", quantity: 1, unit: "L", category: "Dairy", estimatedPriceEUR: 0, checked: false }];
  const result = reconcileConfirmedShoppingPurchases(pantry, shopping, [], [], "2026-09-13", "noop");
  assert.deepEqual(result.pantry, pantry);
  assert.deepEqual(result.shoppingList, shopping);
});
