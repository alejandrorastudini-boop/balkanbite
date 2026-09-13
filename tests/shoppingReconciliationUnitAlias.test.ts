import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("count aliases from shopping state merge deterministically", () => {
  const pantry = [{ id: "p", name: "Huevos", quantity: 4, unit: "uds", category: "Dairy" as const, addedAt: "2026-09-01" }];
  const shopping = [{ id: "s", name: "Huevos", quantity: 2, unit: "pcs", category: "Dairy", estimatedPriceEUR: 0, checked: false }];
  const result = reconcileConfirmedShoppingPurchases(pantry, shopping, ["s"], [], "2026-09-13", "aliases");
  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].quantity, 6);
});
