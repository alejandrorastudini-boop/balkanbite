import assert from "node:assert/strict";
import test from "node:test";
import type { CookLotEvidencePlan } from "../src/utils/cookLotEvidencePlanner";
import { resolveCookLotEvidenceSelection } from "../src/utils/cookLotEvidencePlanner";

const plan: CookLotEvidencePlan = {
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

test("turns only an explicit valid physical lot choice into exact evidence", () => {
  assert.deepEqual(
    resolveCookLotEvidenceSelection(
      plan,
      [{ pantryItemId: "rice", lotId: "lot-b" }],
      "2026-10-04",
    ),
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

test("preserves an explicit unknown choice instead of guessing", () => {
  assert.deepEqual(
    resolveCookLotEvidenceSelection(
      plan,
      [{ pantryItemId: "rice", lotId: null }],
      "2026-10-04",
    ),
    { outcome: "unknown", lotEvidence: [] },
  );
});

test("fails closed on a lot that was not offered by the reviewed plan", () => {
  assert.equal(
    resolveCookLotEvidenceSelection(
      plan,
      [{ pantryItemId: "rice", lotId: "lot-c" }],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
});

test("fails closed on duplicate, missing, or stale review shape", () => {
  const twoPromptPlan: CookLotEvidencePlan = {
    outcome: "review",
    prompts: [
      ...plan.prompts,
      {
        pantryItemId: "beans",
        requiredQuantity: 0.1,
        unit: "kg",
        allowUnknown: true,
        choices: [
          { lotId: "beans-a", acquiredAt: "2026-10-01", remainingQuantity: 0.3, unit: "kg" },
          { lotId: "beans-b", acquiredAt: "2026-10-02", remainingQuantity: 0.3, unit: "kg" },
        ],
      },
    ],
  };
  assert.equal(
    resolveCookLotEvidenceSelection(
      twoPromptPlan,
      [{ pantryItemId: "rice", lotId: "lot-a" }],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
  assert.equal(
    resolveCookLotEvidenceSelection(
      twoPromptPlan,
      [
        { pantryItemId: "rice", lotId: "lot-a" },
        { pantryItemId: "rice", lotId: "lot-b" },
      ],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
  assert.equal(
    resolveCookLotEvidenceSelection(
      plan,
      [{ pantryItemId: "rice", lotId: "lot-a" }],
      "2026-02-30",
    ).outcome,
    "invalid",
  );
});
