import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("authoritative pantry receives only fields intentionally allowed by reconciliation core", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [], [], [],
    [{ name: "Tofu", quantity: 200, unit: "g", category: "Other", estimatedCostEUR: 4.2, expiryDaysLeft: 5 }],
    "2026-09-13", "allowed-fields"
  );
  const item = result.pantry[0];
  assert.equal(item.name, "Tofu");
  assert.equal(item.quantity, 200);
  assert.equal(item.unit, "g");
  assert.equal(item.category, "Other");
  assert.equal(item.estimatedCostEUR, undefined);
  assert.equal(item.expiryDaysLeft, undefined);
});
