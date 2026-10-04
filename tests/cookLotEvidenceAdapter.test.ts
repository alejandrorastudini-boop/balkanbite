import assert from "node:assert/strict";
import test from "node:test";
import type { CookLotEvidencePlan, CookLotEvidencePrompt } from "../src/utils/cookLotEvidencePlanner";
import { buildCookLotEvidence } from "../src/utils/cookLotEvidenceAdapter";

const reviewPlan: CookLotEvidencePlan = {
  outcome: "review",
  prompts: [{
    pantryItemId: "rice",
    requiredQuantity: 0.25,
    unit: "kg",
    allowUnknown: true,
    choices: [
      { lotId: "lot-a", acquiredAt: "2026-10-01", remainingQuantity: 0.6, unit: "kg" },
      { lotId: "lot-b", acquiredAt: "2026-10-02", remainingQuantity: 0.4, unit: "kg" },
    ],
  }],
};

test("builds exact evidence only for an explicitly offered physical lot", () => {
  assert.deepEqual(
    buildCookLotEvidence(reviewPlan, { rice: "lot-b" }, "2026-10-04"),
    {
      outcome: "exact",
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-04",
        deductions: [{ lotId: "lot-b", quantity: 0.25 }],
      }],
    },
  );
});

test("unknown preserves the conservative aggregate path without partial evidence", () => {
  assert.deepEqual(
    buildCookLotEvidence(reviewPlan, { rice: "unknown" }, "2026-10-04"),
    { outcome: "aggregate" },
  );
});

test("fails closed on missing, fabricated, extra or impossible selections", () => {
  assert.equal(buildCookLotEvidence(reviewPlan, {}, "2026-10-04").outcome, "invalid");
  assert.equal(buildCookLotEvidence(reviewPlan, { rice: "lot-z" }, "2026-10-04").outcome, "invalid");
  assert.equal(buildCookLotEvidence(reviewPlan, { rice: "lot-a", beans: "lot-x" }, "2026-10-04").outcome, "invalid");
  assert.equal(buildCookLotEvidence(reviewPlan, { rice: "lot-a" }, "2026-02-30").outcome, "invalid");
});

test("any unknown in a complete multi-item review drops all exact attribution", () => {
  const multi: CookLotEvidencePlan = {
    outcome: "review",
    prompts: [
      ricePrompt,
      {
        pantryItemId: "beans",
        requiredQuantity: 0.1,
        unit: "kg",
        allowUnknown: true,
        choices: [
          { lotId: "beans-a", acquiredAt: "2026-10-01", remainingQuantity: 0.5, unit: "kg" },
          { lotId: "beans-b", acquiredAt: "2026-10-02", remainingQuantity: 0.5, unit: "kg" },
        ],
      },
    ],
  };
  assert.deepEqual(
    buildCookLotEvidence(multi, { rice: "lot-a", beans: "unknown" }, "2026-10-04"),
    { outcome: "aggregate" },
  );
});

test("not-needed accepts only an empty selection map", () => {
  const plan: CookLotEvidencePlan = { outcome: "not-needed", prompts: [] };
  assert.deepEqual(buildCookLotEvidence(plan, {}, "2026-10-04"), { outcome: "aggregate" });
  assert.equal(buildCookLotEvidence(plan, { rice: "lot-a" }, "2026-10-04").outcome, "invalid");
});

function neverPrompt(): never {
  throw new Error("unreachable");
}
