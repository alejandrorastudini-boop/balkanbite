import assert from "node:assert/strict";
import test from "node:test";
import {
  cookRequestSignature,
  type AtomicCookStockExpectation,
} from "../src/utils/confirmedCookFirestore";
import type { CookConfirmation } from "../src/utils/confirmedCookTransaction";

const confirmation: CookConfirmation = {
  cookConfirmationId: "cook-1",
  mealId: "recipe-1",
  confirmed: true,
  ingredients: [
    {
      ingredientId: "allocation-1-deadbeef",
      pantryItemId: "rice-old",
      quantity: 100,
      unit: "g",
    },
    {
      ingredientId: "allocation-2-deadbeef",
      pantryItemId: "rice-new",
      quantity: 0.05,
      unit: "kg",
    },
  ],
};

const expected: AtomicCookStockExpectation[] = [
  {
    pantryItemId: "rice-old",
    quantity: 100,
    unit: "g",
    cookRevision: 2,
  },
  {
    pantryItemId: "rice-new",
    quantity: 0.2,
    unit: "kg",
    cookRevision: 4,
  },
];

test("cook request signature is independent of expected-stock array order", () => {
  assert.equal(
    cookRequestSignature(confirmation, expected),
    cookRequestSignature(confirmation, [...expected].reverse()),
  );
});

test("cook request signature changes when confirmed stock revision/quantity changes", () => {
  const original = cookRequestSignature(confirmation, expected);
  assert.ok(original);

  assert.notEqual(
    original,
    cookRequestSignature(confirmation, [
      expected[0],
      { ...expected[1], cookRevision: 5 },
    ]),
  );
  assert.notEqual(
    original,
    cookRequestSignature(confirmation, [
      expected[0],
      { ...expected[1], quantity: 0.15 },
    ]),
  );
});

test("cook request signature rejects missing, duplicate or unrelated stock baselines", () => {
  assert.equal(cookRequestSignature(confirmation, [expected[0]]), null);
  assert.equal(cookRequestSignature(confirmation, [
    expected[0],
    { ...expected[0] },
  ]), null);
  assert.equal(cookRequestSignature(confirmation, [
    expected[0],
    {
      pantryItemId: "oil",
      quantity: 100,
      unit: "ml",
      cookRevision: 0,
    },
  ]), null);
});
