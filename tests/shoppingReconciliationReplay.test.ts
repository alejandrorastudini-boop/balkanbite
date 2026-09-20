import test from "node:test";
import assert from "node:assert/strict";
import { reconcileConfirmedShoppingPurchases } from "../src/utils/purchasePantryMerge";
import type { PantryItem } from "../src/types";

test("replaying the same confirmed reconciliation does not double-add surviving extras", () => {
  const initial: PantryItem[] = [];
  const extra = [{ name: "Aguacates", quantity: 2, unit: "uds", category: "Produce" }];

  const first = reconcileConfirmedShoppingPurchases(
    initial,
    [],
    [],
    extra,
    "2026-09-13",
    "same-review"
  );
  const second = reconcileConfirmedShoppingPurchases(
    first.pantry,
    [],
    [],
    extra,
    "2026-09-13",
    "same-review"
  );

  assert.equal(first.pantry.length, 1);
  assert.equal(first.pantry[0].quantity, 2);
  assert.deepEqual(first.newlyAppliedSourceIds, ["reconcile:same-review:extra:0"]);
  assert.equal(second.pantry.length, 1);
  assert.equal(second.pantry[0].quantity, 2);
  assert.deepEqual(second.acceptedSourceIds, ["reconcile:same-review:extra:0"]);
  assert.deepEqual(second.newlyAppliedSourceIds, []);
});
