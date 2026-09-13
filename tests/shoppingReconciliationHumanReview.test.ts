import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("a non-selected parser proposal is absent from the confirmed extras input and cannot be written", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [],
    [],
    [],
    [],
    "2026-09-13",
    "human-review-empty"
  );
  assert.deepEqual(result.pantry, []);
});
