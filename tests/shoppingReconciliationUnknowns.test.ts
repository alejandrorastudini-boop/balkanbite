import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("unknown category falls back to Other without inventing cost or expiry", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [],
    [],
    [],
    [{ name: "Producto local", quantity: 1, unit: "pack", category: "Mystery", estimatedCostEUR: 9.99, expiryDaysLeft: 3 }],
    "2026-09-13",
    "unknowns"
  );
  assert.equal(result.pantry[0].category, "Other");
  assert.equal(result.pantry[0].estimatedCostEUR, undefined);
  assert.equal(result.pantry[0].expiryDaysLeft, undefined);
});
