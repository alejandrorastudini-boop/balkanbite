import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { planCookLotEvidenceReview } from "../src/utils/cookLotEvidencePlanner";

const item = (overrides: Partial<PantryItem> = {}): PantryItem => ({
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
        id: "lot-a",
        sourceId: "purchase-a",
        source: "shopping_list",
        acquiredAt: "2026-10-01",
        initialQuantity: 0.6,
        remainingQuantity: 0.6,
        expiryDaysAtAcquisition: 10,
      },
      {
        id: "lot-b",
        sourceId: "purchase-b",
        source: "shopping_list",
        acquiredAt: "2026-10-02",
        initialQuantity: 0.4,
        remainingQuantity: 0.4,
        expiryDaysAtAcquisition: 10,
      },
    ],
  },
  ...overrides,
});

const confirmation = (quantity = 250, unit = "g") => ({
  cookConfirmationId: "cook-review",
  mealId: "rice-meal",
  confirmed: true,
  ingredients: [{
    ingredientId: "rice-ingredient",
    pantryItemId: "rice",
    quantity,
    unit,
  }],
});

test("offers multiple real lots without choosing one and always permits unknown", () => {
  const result = planCookLotEvidenceReview(
    [item()],
    confirmation(),
    "2026-10-04",
  );
  assert.equal(result.outcome, "review");
  if (result.outcome !== "review") return;
  assert.equal(result.prompts.length, 1);
  assert.equal(result.prompts[0].requiredQuantity, 0.25);
  assert.equal(result.prompts[0].unit, "kg");
  assert.equal(result.prompts[0].allowUnknown, true);
  assert.deepEqual(
    result.prompts[0].choices.map(choice => choice.lotId),
    ["lot-a", "lot-b"],
  );
});

test("does not ask for fake precision when stock has one lot or unallocated-only provenance", () => {
  const oneLot = item({
    quantity: 0.6,
    lotState: {
      version: 1,
      unallocatedQuantity: 0,
      activeLots: [item().lotState!.activeLots[0]],
    },
  });
  const unallocated = item({
    lotState: { version: 1, unallocatedQuantity: 1, activeLots: [] },
  });
  assert.equal(
    planCookLotEvidenceReview([oneLot], confirmation(), "2026-10-04").outcome,
    "not-needed",
  );
  assert.equal(
    planCookLotEvidenceReview([unallocated], confirmation(), "2026-10-04").outcome,
    "not-needed",
  );
});

test("does not offer expired food-use lots", () => {
  const result = planCookLotEvidenceReview(
    [item({
      lotState: {
        version: 1,
        unallocatedQuantity: 0,
        activeLots: [
          {
            ...item().lotState!.activeLots[0],
            expiryDaysAtAcquisition: 1,
          },
          item().lotState!.activeLots[1],
        ],
      },
    })],
    confirmation(),
    "2026-10-04",
  );
  assert.equal(result.outcome, "not-needed");
});

test("offers review when multiple real lots together can cover the confirmed amount", () => {
  const result = planCookLotEvidenceReview([item()], confirmation(700, "g"), "2026-10-04");
  assert.equal(result.outcome, "review");
  if (result.outcome !== "review") return;
  assert.equal(result.prompts[0].requiredQuantity, 0.7);
  assert.deepEqual(result.prompts[0].choices.map(choice => choice.lotId), ["lot-a", "lot-b"]);
});

test("does not prompt when real lots together cannot cover the confirmed amount", () => {
  assert.equal(
    planCookLotEvidenceReview([item()], confirmation(1.1, "kg"), "2026-10-04").outcome,
    "not-needed",
  );
});

test("fails closed on impossible reviewed dates and incompatible units", () => {
  assert.equal(
    planCookLotEvidenceReview([item()], confirmation(), "2026-02-30").outcome,
    "invalid",
  );
  assert.equal(
    planCookLotEvidenceReview([item()], confirmation(1, "l"), "2026-10-04").outcome,
    "invalid",
  );
});


test("never offers partial exact evidence when another referenced item cannot be physically attributed", () => {
  const beans: PantryItem = {
    id: "beans",
    name: "Beans",
    quantity: 1,
    unit: "kg",
    category: "Pantry/Grains",
    addedAt: "2026-10-01",
    lotState: { version: 1, unallocatedQuantity: 1, activeLots: [] },
  };
  const multiItemConfirmation = {
    ...confirmation(),
    ingredients: [
      ...confirmation().ingredients,
      { ingredientId: "beans-ingredient", pantryItemId: "beans", quantity: 100, unit: "g" },
    ],
  };
  assert.equal(
    planCookLotEvidenceReview([item(), beans], multiItemConfirmation, "2026-10-04").outcome,
    "not-needed",
  );
});
