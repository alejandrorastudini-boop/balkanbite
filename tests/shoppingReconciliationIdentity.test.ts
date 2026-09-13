import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("reconciliation does not fuzzy-merge different food names", () => {
  const pantry = [{ id: "p", name: "Tomate", quantity: 2, unit: "uds", category: "Produce" as const, addedAt: "2026-09-01" }];
  const shopping = [{ id: "s", name: "Tomate cherry", quantity: 1, unit: "uds", category: "Produce", estimatedPriceEUR: 0, checked: false }];
  const result = reconcileConfirmedShoppingPurchases(pantry, shopping, ["s"], [], "2026-09-13", "identity");
  assert.equal(result.pantry.length, 2);
});
