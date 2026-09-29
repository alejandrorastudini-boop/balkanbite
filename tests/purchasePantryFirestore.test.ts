import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPurchaseMutationId,
  buildPurchasePantryTransactionPlan,
} from "../src/utils/purchasePantryFirestore";

const purchase = (sourceId: string, quantity = 1) => ({
  sourceId,
  source: "shopping_list" as const,
  name: sourceId === "shopping:s2" ? "Leche" : "Tomate",
  quantity,
  unit: sourceId === "shopping:s2" ? "L" : "kg",
  category: sourceId === "shopping:s2" ? "Dairy" : "Produce",
});

test("purchase mutation ID is stable across item order and retry time", () => {
  const a = [purchase("shopping:s1", 0.5), purchase("shopping:s2", 1)];
  const b = [...a].reverse();
  assert.equal(buildPurchaseMutationId(a), buildPurchaseMutationId(b));
  assert.match(buildPurchaseMutationId(a) || "", /^purchase-[0-9a-f]{8}-2$/);

  const baseline = [{
    id: "tomato",
    name: "Tomate",
    quantity: 1,
    unit: "kg",
    category: "Produce" as const,
    addedAt: "2026-09-01",
    cookRevision: 3,
  }];
  const id = buildPurchaseMutationId(a)!;
  const first = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: id,
    baselinePantry: baseline,
    purchases: a,
    acquiredAt: "2026-09-29",
  });
  const laterRetry = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: id,
    baselinePantry: baseline,
    purchases: b,
    acquiredAt: "2026-10-02",
  });
  assert.ok(first && laterRetry);
  assert.equal(first.signature, laterRetry.signature);
});

test("changing confirmed quantity changes mutation identity and signature", () => {
  const firstPurchase = [purchase("shopping:s1", 0.5)];
  const changedPurchase = [purchase("shopping:s1", 0.75)];
  assert.notEqual(
    buildPurchaseMutationId(firstPurchase),
    buildPurchaseMutationId(changedPurchase),
  );

  const baseline = [{
    id: "tomato",
    name: "Tomate",
    quantity: 1,
    unit: "kg",
    category: "Produce" as const,
    addedAt: "2026-09-01",
    cookRevision: 0,
  }];
  const first = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(firstPurchase)!,
    baselinePantry: baseline,
    purchases: firstPurchase,
    acquiredAt: "2026-09-29",
  });
  const changed = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(changedPurchase)!,
    baselinePantry: baseline,
    purchases: changedPurchase,
    acquiredAt: "2026-09-29",
  });
  assert.ok(first && changed);
  assert.notEqual(first.signature, changed.signature);
});

test("transaction plan contains only changed and newly created pantry lots", () => {
  const baseline = [
    {
      id: "tomato",
      name: "Tomate",
      quantity: 1,
      unit: "kg",
      category: "Produce" as const,
      addedAt: "2026-09-01",
      cookRevision: 4,
    },
    {
      id: "salt",
      name: "Sal",
      quantity: 500,
      unit: "g",
      category: "Spices" as const,
      addedAt: "2026-09-01",
      cookRevision: 9,
    },
  ];
  const purchases = [purchase("shopping:s1", 0.5), purchase("shopping:s2", 1)];
  const plan = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(purchases)!,
    baselinePantry: baseline,
    purchases,
    acquiredAt: "2026-09-29",
  });
  assert.ok(plan);
  assert.deepEqual(plan.updates.map(item => item.before.id), ["tomato"]);
  assert.deepEqual(plan.creations.map(item => item.after.id), [
    "purchase-shopping:s2",
  ]);
  assert.deepEqual(
    plan.expectedChanges.map(item => item.pantryItemId).sort(),
    ["purchase-shopping:s2", "tomato"],
  );
});

test("fully rejected deterministic purchase plan is not mislabeled already-applied", () => {
  const invalidUnitPurchase = [{
    sourceId: "shopping:bad-unit",
    source: "shopping_list" as const,
    name: "Tomate",
    quantity: 1,
    unit: "made-up-unit",
    category: "Produce",
  }];
  const plan = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(invalidUnitPurchase)!,
    baselinePantry: [],
    purchases: invalidUnitPurchase,
    acquiredAt: "2026-09-29",
  });
  assert.ok(plan);
  assert.deepEqual(plan.merge.acceptedSourceIds, []);
  assert.equal(plan.merge.rejected.length, 1);
});
