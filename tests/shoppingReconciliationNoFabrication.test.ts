import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("server-suggested price and expiry never cross the authoritative pantry boundary for extras", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [],
    [],
    [],
    [{
      name: "Aguacates",
      quantity: 1,
      unit: "uds",
      category: "Produce",
      estimatedCostEUR: 123.45,
      expiryDaysLeft: 99,
    }],
    "2026-09-13",
    "no-fabrication"
  );

  const item = result.pantry[0];
  assert.equal(item.quantity, 1);
  assert.equal(item.unit, "uds");
  assert.equal(item.estimatedCostEUR, undefined);
  assert.equal(item.expiryDaysLeft, undefined);
});
