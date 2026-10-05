import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVoiceLotEvidence,
  type VoiceLotReviewSelection,
} from "../src/utils/voiceLotEvidenceAdapter";
import type { VoiceLotReviewPlan } from "../src/utils/voiceLotReviewPlanner";

const plan: VoiceLotReviewPlan = {
  outcome: "review",
  prompts: [{
    pantryItemId: "rice",
    requiredQuantity: 0.7,
    unit: "kg",
    purpose: "food-use",
    allowUnknown: true,
    choices: [
      {
        lotId: "a",
        acquiredAt: "2026-10-01",
        remainingQuantity: 0.4,
        unit: "kg",
        expiresOn: "2026-10-10",
      },
      {
        lotId: "b",
        acquiredAt: "2026-10-02",
        remainingQuantity: 0.6,
        unit: "kg",
        expiresOn: "2026-10-11",
      },
    ],
  }],
};

const build = (
  selections: VoiceLotReviewSelection,
  purpose: "food-use" | "discard" = "food-use",
) => buildVoiceLotEvidence(plan, selections, purpose, "2026-10-05");

test("Unknown keeps the entire voice removal aggregate", () => {
  assert.deepEqual(build({ rice: "unknown" }), { outcome: "aggregate" });
});

test("single explicitly selected lot can produce exact evidence when it covers the full removal", () => {
  const singlePlan: VoiceLotReviewPlan = {
    outcome: "review",
    prompts: [{
      ...plan.prompts[0],
      requiredQuantity: 0.3,
    }],
  };
  assert.deepEqual(
    buildVoiceLotEvidence(singlePlan, { rice: "a" }, "food-use", "2026-10-05"),
    {
      outcome: "exact",
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-05",
        purpose: "food-use",
        deductions: [{ lotId: "a", quantity: 0.3 }],
      }],
    },
  );
});

test("multi-lot evidence requires explicit quantities summing exactly to confirmed removal", () => {
  assert.deepEqual(
    build({ rice: { a: 0.4, b: 0.3 } }),
    {
      outcome: "exact",
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-05",
        purpose: "food-use",
        deductions: [
          { lotId: "a", quantity: 0.4 },
          { lotId: "b", quantity: 0.3 },
        ],
      }],
    },
  );
  assert.deepEqual(build({ rice: { a: 0.4, b: 0.2 } }), { outcome: "invalid" });
  assert.deepEqual(build({ rice: { a: 0.4, b: 0.4 } }), { outcome: "invalid" });
});

test("fabricated, duplicate-shape and overdrawn allocations fail closed", () => {
  assert.deepEqual(build({ rice: { fabricated: 0.7 } }), { outcome: "invalid" });
  assert.deepEqual(build({ rice: { a: 0.5, b: 0.2 } }), { outcome: "invalid" });
  assert.deepEqual(build({ rice: {} }), { outcome: "invalid" });
});

test("purpose is immutable between planner and evidence adapter", () => {
  assert.deepEqual(build({ rice: { a: 0.4, b: 0.3 } }, "discard"), { outcome: "invalid" });
});

test("food-use rejects any explicitly expired offered choice even if a stale plan is supplied", () => {
  const stalePlan: VoiceLotReviewPlan = {
    outcome: "review",
    prompts: [{
      ...plan.prompts[0],
      requiredQuantity: 0.3,
      choices: [{ ...plan.prompts[0].choices[0], expired: true }],
    }],
  };
  assert.deepEqual(
    buildVoiceLotEvidence(stalePlan, { rice: "a" }, "food-use", "2026-10-05"),
    { outcome: "invalid" },
  );
});

test("discard accepts expired evidence only when the plan itself was built for discard", () => {
  const discardPlan: VoiceLotReviewPlan = {
    outcome: "review",
    prompts: [{
      ...plan.prompts[0],
      requiredQuantity: 0.3,
      purpose: "discard",
      choices: [{ ...plan.prompts[0].choices[0], expired: true }],
    }],
  };
  assert.deepEqual(
    buildVoiceLotEvidence(discardPlan, { rice: "a" }, "discard", "2026-10-05"),
    {
      outcome: "exact",
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-05",
        purpose: "discard",
        deductions: [{ lotId: "a", quantity: 0.3 }],
      }],
    },
  );
});

test("missing, extra or malformed review selections fail closed", () => {
  assert.deepEqual(build({}), { outcome: "invalid" });
  assert.deepEqual(build({ rice: { a: 0.4, b: 0.3 }, extra: "unknown" }), { outcome: "invalid" });
  assert.deepEqual(
    buildVoiceLotEvidence(plan, { rice: { a: 0.4, b: 0.3 } }, "food-use", "2026-02-30"),
    { outcome: "invalid" },
  );
});

test("not-needed plan accepts only an empty selection and remains aggregate", () => {
  const noReview: VoiceLotReviewPlan = { outcome: "not-needed", prompts: [] };
  assert.deepEqual(
    buildVoiceLotEvidence(noReview, {}, "food-use", "2026-10-05"),
    { outcome: "aggregate" },
  );
  assert.deepEqual(
    buildVoiceLotEvidence(noReview, { rice: "unknown" }, "food-use", "2026-10-05"),
    { outcome: "invalid" },
  );
});
