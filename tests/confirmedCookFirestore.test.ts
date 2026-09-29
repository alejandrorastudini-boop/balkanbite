import assert from "node:assert/strict";
import test from "node:test";
import {
  cookRequestSignature,
  type AtomicCookRequest,
} from "../src/utils/confirmedCookFirestore";

const request = (): AtomicCookRequest => ({
  userId: "alice",
  confirmation: {
    cookConfirmationId: "cook-1",
    mealId: "meal-1",
    confirmed: true,
    ingredients: [
      {
        ingredientId: "allocation-2",
        pantryItemId: "lot-b",
        quantity: 50,
        unit: "g",
      },
      {
        ingredientId: "allocation-1",
        pantryItemId: "lot-a",
        quantity: 100,
        unit: "g",
      },
    ],
  },
  expectedStock: [
    {
      pantryItemId: "lot-b",
      quantity: 0.2,
      unit: "kg",
      cookRevision: 4,
    },
    {
      pantryItemId: "lot-a",
      quantity: 100,
      unit: "g",
      cookRevision: 2,
    },
  ],
});

test("cook request signature is canonical across allocation and stock order", () => {
  const first = request();
  const reordered: AtomicCookRequest = {
    ...first,
    confirmation: {
      ...first.confirmation,
      ingredients: [...first.confirmation.ingredients].reverse(),
    },
    expectedStock: [...first.expectedStock].reverse(),
  };
  assert.equal(cookRequestSignature(first), cookRequestSignature(reordered));
});

test("cook request signature binds exact quantity unit and revision baseline", () => {
  const first = request();
  const changes: AtomicCookRequest[] = [
    {
      ...first,
      expectedStock: first.expectedStock.map(item =>
        item.pantryItemId === "lot-a"
          ? { ...item, quantity: 120 }
          : item,
      ),
    },
    {
      ...first,
      expectedStock: first.expectedStock.map(item =>
        item.pantryItemId === "lot-a"
          ? { ...item, unit: "kg" }
          : item,
      ),
    },
    {
      ...first,
      expectedStock: first.expectedStock.map(item =>
        item.pantryItemId === "lot-a"
          ? { ...item, cookRevision: 3 }
          : item,
      ),
    },
  ];
  for (const changed of changes) {
    assert.notEqual(cookRequestSignature(first), cookRequestSignature(changed));
  }
});

test("missing duplicate or unrelated expected stock fails closed", () => {
  const first = request();
  for (const expectedStock of [
    [first.expectedStock[0]],
    [...first.expectedStock, first.expectedStock[0]],
    [...first.expectedStock, {
      pantryItemId: "other",
      quantity: 1,
      unit: "pcs",
      cookRevision: 0,
    }],
  ]) {
    assert.equal(
      cookRequestSignature({ ...first, expectedStock }),
      null,
    );
  }
});

test("invalid revision or nonpositive baseline quantity fails closed", () => {
  const first = request();
  assert.equal(cookRequestSignature({
    ...first,
    expectedStock: first.expectedStock.map(item =>
      item.pantryItemId === "lot-a"
        ? { ...item, cookRevision: -1 }
        : item,
    ),
  }), null);
  assert.equal(cookRequestSignature({
    ...first,
    expectedStock: first.expectedStock.map(item =>
      item.pantryItemId === "lot-a"
        ? { ...item, quantity: 0 }
        : item,
    ),
  }), null);
});
