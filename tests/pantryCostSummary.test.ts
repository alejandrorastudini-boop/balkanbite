import assert from "node:assert/strict";
import test from "node:test";
import {
  knownPantryCostEUR,
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
