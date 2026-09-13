import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("only reviewed extras passed across the UI boundary can mutate pantry", () => {
  const proposedExtras = [
    { name: "Aguacates", quantity: 1, unit: "uds", category: "Produce" },
    { name: "Pan", quantity: 1, unit: "pack", category: "Pantry/Grains" },
  ];
  const reviewedExtras = [proposedExtras[1]];

  const result = reconcileConfirmedShoppingPurchases(
    [],
    [],
    [],
    reviewedExtras,
    "2026-09-13",
    "review-selection"
  );

  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].name, "Pan");
  assert.equal(result.pantry.some((item) => item.name === "Aguacates"), false);
});
