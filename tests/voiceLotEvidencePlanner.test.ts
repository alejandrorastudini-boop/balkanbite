import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { planVoiceLotEvidenceReview } from "../src/utils/voiceLotEvidencePlanner";

const pantry = (expiryDaysAtAcquisition?: number): PantryItem[] => [{
  id: "milk",
  name: "Milk",
  quantity: 2,
  unit: "l",
  category: "Dairy",
  addedAt: "2026-10-01",
  lotState: {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [
      {
        id: "lot-a", sourceId: "a", source: "shopping_list",
        acquiredAt: "2026-10-01", initialQuantity: 1, remainingQuantity: 1,
        ...(expiryDaysAtAcquisition === undefined ? {} : { expiryDaysAtAcquisition }),
      },
      {
        id: "lot-b", sourceId: "b", source: "shopping_list",
        acquiredAt: "2026-10-04", initialQuantity: 1, remainingQuantity: 1,
        ...(expiryDaysAtAcquisition === undefined ? {} : { expiryDaysAtAcquisition }),
      },
    ],
  },
}];

const deduction = [{ pantryItemId: "milk", consumedQuantity: 0.5, unit: "l" }];

test("voice lot planner exposes persisted choices without choosing one", () => {
  const plan = planVoiceLotEvidenceReview(pantry(), deduction, "food-use", "2026-10-05");
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.equal(plan.prompts[0]?.allowUnknown, true);
  assert.deepEqual(plan.prompts[0]?.choices.map(choice => choice.lotId), ["lot-a", "lot-b"]);
});

test("food-use excludes explicitly expired lots but discard keeps them reviewable", () => {
  const food = planVoiceLotEvidenceReview(pantry(2), deduction, "food-use", "2026-10-05");
  assert.equal(food.outcome, "review");
  if (food.outcome === "review") {
    assert.deepEqual(food.prompts[0]?.choices.map(choice => choice.lotId), ["lot-b"]);
  }

  const discard = planVoiceLotEvidenceReview(pantry(2), deduction, "discard", "2026-10-05");
  assert.equal(discard.outcome, "review");
  if (discard.outcome === "review") {
    assert.equal(discard.prompts[0]?.choices.find(choice => choice.lotId === "lot-a")?.expired, true);
  }
});

test("unallocated or missing provenance never becomes exact lot evidence", () => {
  const legacy = pantry()[0]!;
  const plan = planVoiceLotEvidenceReview(
    [{ ...legacy, lotState: { version: 1, unallocatedQuantity: 2, activeLots: [] } }],
    deduction,
    "food-use",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "not-needed");
});

test("review is all-or-nothing across a multi-item voice mutation", () => {
  const plan = planVoiceLotEvidenceReview(
    [
      ...pantry(),
      { id: "rice", name: "Rice", quantity: 1, unit: "kg", category: "Grains", addedAt: "2026-10-01" },
    ],
    [...deduction, { pantryItemId: "rice", consumedQuantity: 0.2, unit: "kg" }],
    "food-use",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "not-needed");
});

test("invalid date, purpose or incompatible unit fails closed", () => {
  assert.equal(planVoiceLotEvidenceReview(pantry(), deduction, "food-use", "2026-02-30").outcome, "invalid");
  assert.equal(planVoiceLotEvidenceReview(pantry(), deduction, "other" as never, "2026-10-05").outcome, "invalid");
  assert.equal(planVoiceLotEvidenceReview(pantry(), [{ ...deduction[0], unit: "pcs" }], "food-use", "2026-10-05").outcome, "invalid");
});
