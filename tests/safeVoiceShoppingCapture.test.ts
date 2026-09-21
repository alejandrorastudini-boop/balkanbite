import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfirmedVoiceShoppingItems,
  normalizeVoiceShoppingItems,
} from "../src/utils/safeVoiceShoppingCapture";

test("voice shopping capture keeps only explicit positive name quantity and unit", () => {
  const result = normalizeVoiceShoppingItems([
    {
      name: "  Rice  ",
      quantity: 2,
      unit: " kg ",
      category: "Pantry/Grains",
      estimatedPriceEUR: 8.5,
      checked: true,
      purchaseAmountConfirmed: true,
    },
    {
      name: "Milk",
      quantity: 1,
      unit: "l",
    },
  ]);

  assert.deepEqual(result, {
    accepted: [
      {
        name: "Rice",
        quantity: 2,
        unit: "kg",
        category: "Pantry/Grains",
      },
      {
        name: "Milk",
        quantity: 1,
        unit: "l",
        category: "",
      },
    ],
    rejectedCount: 0,
  });
});

test("voice shopping capture rejects incomplete or non-finite rows", () => {
  const result = normalizeVoiceShoppingItems([
    null,
    "rice",
    { name: "", quantity: 1, unit: "kg" },
    { name: "Rice", quantity: 0, unit: "kg" },
    { name: "Rice", quantity: Number.NaN, unit: "kg" },
    { name: "Rice", quantity: Number.POSITIVE_INFINITY, unit: "kg" },
    { name: "Rice", quantity: 1, unit: "" },
    { name: "Rice", quantity: 1 },
  ]);

  assert.deepEqual(result.accepted, []);
  assert.equal(result.rejectedCount, 8);
});

test("localized name fallback is deterministic and trimmed", () => {
  const result = normalizeVoiceShoppingItems([
    {
      nameEn: "  Tomatoes ",
      name: "Домати",
      quantity: 3,
      unit: " pcs ",
    },
    {
      name: "",
      nameEs: " Cebolla ",
      quantity: 1,
      unit: "ud",
    },
  ]);

  assert.deepEqual(result.accepted, [
    {
      name: "Tomatoes",
      quantity: 3,
      unit: "pcs",
      category: "",
    },
    {
      name: "Cebolla",
      quantity: 1,
      unit: "ud",
      category: "",
    },
  ]);
});

test("confirmed voice shopping items never inherit model price or purchase authority", () => {
  const result = buildConfirmedVoiceShoppingItems(
    [
      {
        name: "Rice",
        quantity: 2,
        unit: "kg",
        category: "Pantry/Grains",
        estimatedPriceEUR: 999,
        checked: true,
        purchaseAmountConfirmed: true,
        amountOrigin: "ai_estimated",
      },
    ],
    (index) => `voice-shop-${index}`,
  );

  assert.deepEqual(result, {
    items: [
      {
        id: "voice-shop-0",
        name: "Rice",
        quantity: 2,
        unit: "kg",
        category: "Pantry/Grains",
        checked: false,
        amountOrigin: "user_entered",
        purchaseAmountConfirmed: false,
      },
    ],
    rejectedCount: 0,
  });

  assert.equal("estimatedPriceEUR" in result.items[0], false);
});

test("builder reports rejected rows instead of inventing defaults", () => {
  const result = buildConfirmedVoiceShoppingItems(
    [
      { name: "Rice", quantity: 1, unit: "kg" },
      { name: "Oil", quantity: undefined, unit: "l" },
    ],
    (index) => `voice-shop-${index}`,
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.rejectedCount, 1);
});
