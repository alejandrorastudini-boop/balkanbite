import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPurchaseMutationId,
  buildPurchasePantryTransactionPlan,
  serializePurchasePantryItemForWrite,
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

test("fully rejected duplicate-source batch is not mislabeled already-applied", () => {
  const duplicatePurchases = [
    purchase("shopping:dup", 0.5),
    purchase("shopping:dup", 0.75),
  ];
  const plan = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(duplicatePurchases)!,
    baselinePantry: [],
    purchases: duplicatePurchases,
    acquiredAt: "2026-09-29",
  });
  assert.ok(plan);
  assert.deepEqual(plan.merge.acceptedSourceIds, []);
  assert.deepEqual(plan.merge.newlyAppliedSourceIds, []);
  assert.equal(plan.merge.rejected.length, 2);
  assert.ok(plan.merge.rejected.every(item => item.reason === "duplicate_source"));
});


test("purchase transaction plan carries active lot state for new and merged acquisitions", () => {
  const baseline = [{
    id: "tomato",
    name: "Tomate",
    quantity: 1,
    unit: "kg",
    category: "Produce" as const,
    addedAt: "2026-09-01",
    cookRevision: 4,
  }];
  const purchases = [purchase("shopping:s1", 0.5), purchase("shopping:s2", 1)];
  const plan = buildPurchasePantryTransactionPlan({
    userId: "alice",
    mutationId: buildPurchaseMutationId(purchases)!,
    baselinePantry: baseline,
    purchases,
    acquiredAt: "2026-09-29",
  });
  assert.ok(plan);
  assert.equal(plan.updates[0].after.lotState?.unallocatedQuantity, 1);
  assert.equal(plan.updates[0].after.lotState?.activeLots[0].sourceId, "shopping:s1");
  assert.equal(plan.creations[0].after.lotState?.unallocatedQuantity, 0);
  assert.equal(plan.creations[0].after.lotState?.activeLots[0].sourceId, "shopping:s2");
});

test("purchase writer serializes verified lot state and rejects inconsistent overlay", () => {
  const item = {
    id: "tomato",
    name: "Tomate",
    quantity: 1.5,
    unit: "kg",
    category: "Produce" as const,
    addedAt: "2026-09-01",
    lotState: {
      unallocatedQuantity: 1,
      activeLots: [{
        id: "acquisition:shopping:s1",
        sourceId: "shopping:s1",
        source: "shopping_list" as const,
        acquiredAt: "2026-09-29",
        initialQuantity: 0.5,
        remainingQuantity: 0.5,
        initialEstimatedCostEUR: 2,
      }],
    },
  };
  const serialized = serializePurchasePantryItemForWrite(item, "alice", 5);
  assert.deepEqual(serialized?.lotState, item.lotState);
  assert.equal(
    serializePurchasePantryItemForWrite(
      { ...item, quantity: 2 },
      "alice",
      5,
    ),
    null,
  );
});
