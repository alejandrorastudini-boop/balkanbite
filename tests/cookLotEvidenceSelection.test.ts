import assert from "node:assert/strict";
import test from "node:test";
import type { CookLotEvidencePlan } from "../src/utils/cookLotEvidencePlanner";
import { buildCookLotEvidenceFromSelections } from "../src/utils/cookLotEvidenceSelection";

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

test("explicit reviewed lot selection becomes exact replay-bound evidence", () => {
  assert.deepEqual(
    buildCookLotEvidenceFromSelections(
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

test("unknown selection emits no partial physical evidence", () => {
  assert.deepEqual(
    buildCookLotEvidenceFromSelections(
      plan,
      [{ pantryItemId: "rice", lotId: null }],
      "2026-10-04",
    ),
    { outcome: "unknown", lotEvidence: undefined },
  );
});

test("unoffered, duplicate, missing, or non-review selections fail closed", () => {
  assert.equal(
    buildCookLotEvidenceFromSelections(
      plan,
      [{ pantryItemId: "rice", lotId: "invented-lot" }],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
  assert.equal(
    buildCookLotEvidenceFromSelections(
      plan,
      [
        { pantryItemId: "rice", lotId: "lot-a" },
        { pantryItemId: "rice", lotId: "lot-b" },
      ],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
  assert.equal(
    buildCookLotEvidenceFromSelections(plan, [], "2026-10-04").outcome,
    "invalid",
  );
  assert.equal(
    buildCookLotEvidenceFromSelections(
      { outcome: "not-needed", prompts: [] },
      [],
      "2026-10-04",
    ).outcome,
    "invalid",
  );
});


test("selection boundary rejects impossible reviewed calendar dates", () => {
  assert.equal(
    buildCookLotEvidenceFromSelections(
      plan,
      [{ pantryItemId: "rice", lotId: "lot-a" }],
      "2026-02-30",
    ).outcome,
    "invalid",
  );
});
