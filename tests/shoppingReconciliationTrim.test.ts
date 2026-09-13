import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("confirmed extra names and units are trimmed before persistence", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [], [], [],
    [{ name: "  Arroz  ", quantity: 1, unit: " kg ", category: "Pantry/Grains" }],
    "2026-09-13", "trim"
  );
  assert.equal(result.pantry[0].name, "Arroz");
  assert.equal(result.pantry[0].unit, "kg");
});
