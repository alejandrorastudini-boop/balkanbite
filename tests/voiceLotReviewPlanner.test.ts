import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { planVoiceLotReview } from "../src/utils/voiceLotReviewPlanner";

const pantryItem = (lotState: PantryItem["lotState"]): PantryItem => ({
  id: "milk",
  name: "Milk",
  quantity: 1,
  unit: "l",
  category: "Dairy",
  addedAt: "2026-10-01",
  lotState,
});

const lots = {
  version: 1 as const,
  unallocatedQuantity: 0,
  activeLots: [
    {
      id: "old",
      source: "shopping_list" as const,
      sourceId: "s-old",
      acquiredAt: "2026-10-01",
      initialQuantity: 0.4,
      remainingQuantity: 0.4,
      expiryDaysAtAcquisition: 2,
    },
    {
      id: "fresh",
      source: "shopping_list" as const,
      sourceId: "s-fresh",
      acquiredAt: "2026-10-04",
      initialQuantity: 0.6,
      remainingQuantity: 0.6,
      expiryDaysAtAcquisition: 5,
    },
  ],
};

const deduction = [{
  ingredientName: "milk",
  pantryItemId: "milk",
  consumedQuantity: 0.3,
  unit: "l",
}];

test("food-use never offers a lot explicitly expired on the review date", () => {
  const plan = planVoiceLotReview(
    [pantryItem(lots)],
    deduction,
    "food-use",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.deepEqual(plan.prompts[0].choices.map(choice => choice.lotId), ["fresh"]);
  assert.equal(plan.prompts[0].allowUnknown, true);
});

test("discard may explicitly review an expired physical lot", () => {
  const plan = planVoiceLotReview(
    [pantryItem(lots)],
    deduction,
    "discard",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.deepEqual(plan.prompts[0].choices.map(choice => choice.lotId), ["old", "fresh"]);
  assert.equal(plan.prompts[0].choices[0].expired, true);
});

test("planner never allocates quantities or invents lots", () => {
  const plan = planVoiceLotReview(
    [pantryItem(lots)],
    [{ ...deduction[0], consumedQuantity: 0.7 }],
    "discard",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.equal(plan.prompts[0].requiredQuantity, 0.7);
  assert.equal("deductions" in plan.prompts[0], false);
  assert.equal(plan.prompts[0].allowUnknown, true);
});

test("insufficient eligible known lots falls back to aggregate instead of fabricating provenance", () => {
  const plan = planVoiceLotReview(
    [pantryItem(lots)],
    [{ ...deduction[0], consumedQuantity: 0.7 }],
    "food-use",
    "2026-10-05",
  );
  assert.deepEqual(plan, { outcome: "not-needed", prompts: [] });
});

test("explicit invalid lotState fails closed while missing legacy lotState stays aggregate", () => {
  const invalid = pantryItem({
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [{ ...lots.activeLots[0], remainingQuantity: 2 }],
  });
  assert.deepEqual(
    planVoiceLotReview([invalid], deduction, "discard", "2026-10-05"),
    { outcome: "invalid", prompts: [] },
  );

  const legacy = pantryItem(undefined);
  assert.deepEqual(
    planVoiceLotReview([legacy], deduction, "discard", "2026-10-05"),
    { outcome: "not-needed", prompts: [] },
  );
});

test("unit conversion is deterministic before lot review", () => {
  const gramLots = {
    version: 1 as const,
    unallocatedQuantity: 0,
    activeLots: [
      { ...lots.activeLots[0], id: "a", sourceId: "a", remainingQuantity: 0.4, initialQuantity: 0.4 },
      { ...lots.activeLots[1], id: "b", sourceId: "b", remainingQuantity: 0.6, initialQuantity: 0.6 },
    ],
  };
  const plan = planVoiceLotReview(
    [pantryItem(gramLots)],
    [{ ingredientName: "milk", pantryItemId: "milk", consumedQuantity: 300, unit: "ml" }],
    "discard",
    "2026-10-05",
  );
  assert.equal(plan.outcome, "review");
  if (plan.outcome !== "review") return;
  assert.equal(plan.prompts[0].requiredQuantity, 0.3);
});
