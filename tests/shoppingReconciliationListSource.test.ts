import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("AI-provided list-item details are irrelevant: current shopping state supplies amount and unit", () => {
  const shopping = [
    { id: "tomato", name: "Tomate", quantity: 3, unit: "uds", category: "Produce", estimatedPriceEUR: 0, checked: false },
  ];

  const result = reconcileConfirmedShoppingPurchases(
    [],
    shopping,
    ["tomato"],
    [],
    "2026-09-13",
    "list-source"
  );

  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].quantity, 3);
  assert.equal(result.pantry[0].unit, "uds");
});
