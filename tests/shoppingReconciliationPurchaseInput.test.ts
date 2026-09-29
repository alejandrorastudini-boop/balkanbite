import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfirmedShoppingReconciliationInput,
  reconcileConfirmedShoppingPurchases,
} from "../src/utils/purchasePantryMerge";

const shopping = [
  {
    id: "milk",
    name: "Leche",
    quantity: 1,
    unit: "L",
    category: "Dairy",
    estimatedPriceEUR: 4.99,
    checked: false,
  },
  {
    id: "bread",
    name: "Pan",
    quantity: 2,
    unit: "pack",
    category: "Pantry/Grains",
    estimatedPriceEUR: 0,
    checked: false,
  },
];

test("reviewed reconciliation input uses selected list rows and stable extra source IDs", () => {
  const input = buildConfirmedShoppingReconciliationInput(
    shopping,
    ["milk", "missing", "milk"],
    [
      {
        name: "Tomates",
        quantity: 0.5,
        unit: "kg",
        category: "Produce",
        estimatedCostEUR: 99,
        expiryDaysLeft: 1,
      },
    ],
    "rec-123",
  );

  assert.deepEqual(input.requestedIds, ["milk", "missing"]);
  assert.deepEqual(input.unresolvedPurchasedItemIds, ["missing"]);
  assert.equal(input.purchases.length, 2);
  assert.deepEqual(input.purchases[0], {
    sourceId: "shopping:milk",
    source: "shopping_list",
    name: "Leche",
    quantity: 1,
    unit: "L",
    category: "Dairy",
    estimatedCostEUR: 4.99,
  });
  assert.deepEqual(input.purchases[1], {
    sourceId: "reconcile:rec-123:extra:0",
    source: "confirmed_reconciliation",
    name: "Tomates",
    quantity: 0.5,
    unit: "kg",
    category: "Produce",
  });
  assert.equal(input.extraSourceIds.get("reconcile:rec-123:extra:0"), 0);
  assert.deepEqual(input.rejectedExtraItems, []);
});

test("invalid extra stays rejected and never enters transaction input", () => {
  const input = buildConfirmedShoppingReconciliationInput(
    shopping,
    [],
    [
      { name: "Aguacate", quantity: 0, unit: "pcs" },
      { name: "Huevos", quantity: 6, unit: "" },
    ],
    "rec-456",
  );
  assert.deepEqual(input.purchases, []);
  assert.equal(input.rejectedExtraItems.length, 2);
  assert.ok(input.rejectedExtraItems.every(item => item.reason === "invalid_extra"));
});

test("missing reconciliation ID rejects extras but does not invalidate selected list purchases", () => {
  const input = buildConfirmedShoppingReconciliationInput(
    shopping,
    ["bread"],
    [{ name: "Huevos", quantity: 6, unit: "pcs" }],
    "",
  );
  assert.deepEqual(input.purchases.map(item => item.sourceId), ["shopping:bread"]);
  assert.equal(input.rejectedExtraItems.length, 1);
  assert.equal(input.rejectedExtraItems[0].reason, "invalid_extra");
});

test("wrapper remains behaviorally aligned with extracted purchase input", () => {
  const input = buildConfirmedShoppingReconciliationInput(
    shopping,
    ["milk"],
    [{ name: "Tomates", quantity: 0.5, unit: "kg", category: "Produce" }],
    "rec-789",
  );
  const result = reconcileConfirmedShoppingPurchases(
    [],
    shopping,
    ["milk"],
    [{ name: "Tomates", quantity: 0.5, unit: "kg", category: "Produce" }],
    "2026-09-29",
    "rec-789",
  );

  assert.deepEqual(
    result.acceptedSourceIds.slice().sort(),
    input.purchases.map(item => item.sourceId).sort(),
  );
  assert.deepEqual(result.unresolvedPurchasedItemIds, []);
  assert.deepEqual(result.rejectedExtraItems, []);
  assert.deepEqual(result.shoppingList.map(item => item.id), ["bread"]);
});
