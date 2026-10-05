import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { planVoiceLotEvidenceReview } from "../src/utils/voiceLotEvidencePlanner";

const pantryItem = (expiryDaysAtAcquisition?: number): PantryItem => ({
  id: "rice",
  name: "Rice",
  quantity: 1,
  unit: "kg",
  category: "Pantry/Grains",
  addedAt: "2026-10-01",
  lotState: {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [
      {
        id: "old",
        sourceId: "purchase:old",
        source: "purchase",
        acquiredAt: "2026-09-01",
        initialQuantity: 0.4,
        remainingQuantity: 0.4,
        ...(expiryDaysAtAcquisition === undefined ? {} : { expiryDaysAtAcquisition }),
      },
      {
        id: "new",
        sourceId: "purchase:new",
        source: "purchase",
        acquiredAt: "2026-10-03",
        initialQuantity: 0.6,
        remainingQuantity: 0.6,
      },
    ],
  },
});

const deduction = (quantity = 0.7) => [{
  ingredientName: "Rice",
  pantryItemId: "rice",
  consumedQuantity: quantity,
  unit: "kg",
}];

test("voice planner offers real lots without choosing a split", () => {
  const plan = planVoiceLotEvidenceReview(
    [pantryItem()],
    deduction(),
    "food-use",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.equal(plan.prompts[0].requiredQuantity, 0.7);
  assert.deepEqual(plan.prompts[0].choices.map(choice => choice.lotId), ["old", "new"]);
  assert.equal(plan.prompts[0].allowUnknown, true);
});

test("food use excludes explicitly expired lots and does not fabricate coverage", () => {
  assert.equal(
    planVoiceLotEvidenceReview(
      [pantryItem(2)],
      deduction(),
      "food-use",
      "2026-10-05",
    ).outcome,
    "not-needed",
  );
});

test("discard may offer an explicitly expired lot because it is not consumption", () => {
  const plan = planVoiceLotEvidenceReview(
    [pantryItem(2)],
    deduction(),
    "discard",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.deepEqual(plan.prompts[0].choices.map(choice => choice.lotId), ["old", "new"]);
});

test("planner refuses incompatible units and invalid review dates", () => {
  assert.equal(
    planVoiceLotEvidenceReview(
      [pantryItem()],
      [{ ...deduction()[0], unit: "pcs" }],
      "food-use",
      "2026-10-05",
    ).outcome,
    "invalid",
  );
  assert.equal(
    planVoiceLotEvidenceReview([pantryItem()], deduction(), "food-use", "2026-02-31").outcome,
    "invalid",
  );
});
