import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";
import type { PantryItem, ShoppingItem } from "../src/types";

const pantry: PantryItem[] = [
  {
    id: "p-oil",
    name: "Aceite",
    quantity: 1,
    unit: "bottle",
    category: "Other",
    addedAt: "2026-09-13",
  },
];

const shopping: ShoppingItem[] = [];

test("fallback-proposed extra does nothing unless the UI explicitly confirms it", () => {
  const fallbackProposal = {
    name: "Aguacates",
    quantity: 1,
    unit: "uds",
    category: "Produce",
    estimatedCostEUR: 1.99,
    expiryDaysLeft: 7,
  };

  const notConfirmed = reconcileConfirmedShoppingPurchases(
    pantry,
    shopping,
    [],
    [],
    "2026-09-13",
    "fallback-review"
  );
  assert.deepEqual(notConfirmed.pantry, pantry);

  const confirmed = reconcileConfirmedShoppingPurchases(
    pantry,
    shopping,
    [],
    [fallbackProposal],
    "2026-09-13",
    "fallback-review"
  );
  const avocado = confirmed.pantry.find((item) => item.name === "Aguacates");
  assert.ok(avocado);
  assert.equal(avocado.quantity, 1);
  assert.equal(avocado.unit, "uds");
  assert.equal(avocado.estimatedCostEUR, undefined);
  assert.equal(avocado.expiryDaysLeft, undefined);
});

test("incomplete fallback proposals cannot become pantry facts even when passed through", () => {
  const result = reconcileConfirmedShoppingPurchases(
    pantry,
    shopping,
    [],
    [
      { name: "Pan", quantity: 1 },
      { name: "Leche", unit: "L" },
      { name: "Arroz", quantity: "2", unit: "kg" },
    ],
    "2026-09-13",
    "fallback-incomplete"
  );

  assert.deepEqual(result.pantry, pantry);
  assert.equal(result.rejectedExtraItems.length, 3);
});
