import assert from "node:assert/strict";
import test from "node:test";
import {
  knownPantryCostEUR,
  knownPantryRemainingCostEUR,
  summarizePantryCosts,
} from "../src/utils/pantryCostSummary";

test("complete pantry cost total requires every item to have a finite non-negative number", () => {
  assert.deepEqual(
    summarizePantryCosts([
      { estimatedCostEUR: 2 },
      { estimatedCostEUR: 3.5 },
    ]),
    {
      totalEUR: 5.5,
      knownItemCount: 2,
      unknownItemCount: 0,
      complete: true,
    },
  );
});

test("null and undefined remain unknown instead of becoming zero", () => {
  for (const value of [null, undefined]) {
    const summary = summarizePantryCosts([
      { estimatedCostEUR: 2 },
      { estimatedCostEUR: value },
    ]);
    assert.equal(summary.totalEUR, null);
    assert.equal(summary.complete, false);
    assert.equal(summary.knownItemCount, 1);
    assert.equal(summary.unknownItemCount, 1);
  }
});

test("malformed or impossible numeric costs remain unknown", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    assert.equal(knownPantryCostEUR(value), null);
    assert.equal(
      summarizePantryCosts([{ estimatedCostEUR: value as any }]).totalEUR,
      null,
    );
  }
});

test("explicit zero cost remains valid", () => {
  assert.equal(knownPantryCostEUR(0), 0);
  assert.deepEqual(
    summarizePantryCosts([{ estimatedCostEUR: 0 }]),
    {
      totalEUR: 0,
      knownItemCount: 1,
      unknownItemCount: 0,
      complete: true,
    },
  );
});

test("empty pantry has a deterministic zero total", () => {
  assert.deepEqual(summarizePantryCosts([]), {
    totalEUR: 0,
    knownItemCount: 0,
    unknownItemCount: 0,
    complete: true,
  });
});

test("exact fully allocated lots derive remaining value proportionally", () => {
  const item = { estimatedCostEUR: null, quantity: 3, unit: "pcs", lotState: { version: 1 as const, unallocatedQuantity: 0, activeLots: [{ id: "acquisition:shop-a", sourceId: "shop-a", source: "shopping_list" as const, acquiredAt: "2026-10-01", initialQuantity: 4, remainingQuantity: 3, initialEstimatedCostEUR: 8 }] } };
  assert.equal(knownPantryRemainingCostEUR(item), 6);
  assert.equal(summarizePantryCosts([item]).totalEUR, 6);
});

test("lot-derived value stays unknown with unallocated stock or missing cost", () => {
  assert.equal(knownPantryRemainingCostEUR({ estimatedCostEUR: null, quantity: 4, unit: "pcs", lotState: { version: 1, unallocatedQuantity: 1, activeLots: [{ id: "acquisition:shop-a", sourceId: "shop-a", source: "shopping_list", acquiredAt: "2026-10-01", initialQuantity: 4, remainingQuantity: 3, initialEstimatedCostEUR: 8 }] } }), null);
  assert.equal(knownPantryRemainingCostEUR({ estimatedCostEUR: null, quantity: 2, unit: "pcs", lotState: { version: 1, unallocatedQuantity: 0, activeLots: [{ id: "acquisition:shop-b", sourceId: "shop-b", source: "shopping_list", acquiredAt: "2026-10-01", initialQuantity: 2, remainingQuantity: 2 }] } }), null);
});

test("invalid explicit lot state cannot become monetary authority", () => {
  assert.equal(knownPantryRemainingCostEUR({ estimatedCostEUR: null, quantity: 5, unit: "pcs", lotState: { version: 1, unallocatedQuantity: 0, activeLots: [{ id: "acquisition:shop-a", sourceId: "shop-a", source: "shopping_list", acquiredAt: "2026-10-01", initialQuantity: 4, remainingQuantity: 3, initialEstimatedCostEUR: 8 }] } }), null);
});
