import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("NaN, zero and negative extra quantities are rejected", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [], [], [],
    [
      { name: "A", quantity: Number.NaN, unit: "uds" },
      { name: "B", quantity: 0, unit: "uds" },
      { name: "C", quantity: -1, unit: "uds" },
    ],
    "2026-09-13", "invalid-numbers"
  );
  assert.equal(result.pantry.length, 0);
  assert.equal(result.rejectedExtraItems.length, 3);
});
