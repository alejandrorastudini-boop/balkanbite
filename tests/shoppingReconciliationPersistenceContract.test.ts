import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";

test("reconciliation result is plain serializable state for local persistence", () => {
  const result = reconcileConfirmedShoppingPurchases(
    [],
    [],
    [],
    [{ name: "Aguacates", quantity: 2, unit: "uds", category: "Produce" }],
    "2026-09-13",
    "persistable"
  );

  const roundTrip = JSON.parse(JSON.stringify({ pantry: result.pantry, shoppingList: result.shoppingList }));
  assert.equal(roundTrip.pantry[0].name, "Aguacates");
  assert.equal(roundTrip.pantry[0].quantity, 2);
  assert.deepEqual(roundTrip.shoppingList, []);
});
