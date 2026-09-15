import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVoicePantryItems } from "../src/utils/safeVoicePantryCapture";

test("voice pantry capture preserves confirmed quantity/unit without inventing optional values", () => {
  const result = normalizeVoicePantryItems([
    {
      name: "кисело мляко",
      nameEn: "Yogurt",
      quantity: 2,
      unit: "cups",
      category: "dairy",
    },
  ]);

  assert.deepEqual(result, {
    accepted: [
      {
        name: "Yogurt",
        quantity: 2,
        unit: "cups",
        category: "Dairy",
      },
    ],
    rejectedCount: 0,
  });
  assert.equal(Object.hasOwn(result.accepted[0], "expiryDaysLeft"), false);
  assert.equal(Object.hasOwn(result.accepted[0], "estimatedCostEUR"), false);
});

test("voice pantry capture refuses missing or invalid quantity and unit", () => {
  const result = normalizeVoicePantryItems([
    { name: "домати", nameEn: "Tomatoes", category: "produce" },
    { name: "Rice", quantity: 0, unit: "kg", category: "grain" },
    { name: "Milk", quantity: 1, unit: "   ", category: "dairy" },
  ]);

  assert.deepEqual(result, { accepted: [], rejectedCount: 3 });
});

test("AI-inferred voice price and expiry never become pantry facts", () => {
  const result = normalizeVoicePantryItems([
    {
      name: "Salt",
      quantity: 1,
      unit: "pack",
      category: "spice",
      shelfLifeDays: 365,
      estimatedCostEUR: 2.5,
    },
  ]);

  assert.deepEqual(result, {
    accepted: [
      {
        name: "Salt",
        quantity: 1,
        unit: "pack",
        category: "Spices",
      },
    ],
    rejectedCount: 0,
  });
  assert.equal(Object.hasOwn(result.accepted[0], "expiryDaysLeft"), false);
  assert.equal(Object.hasOwn(result.accepted[0], "estimatedCostEUR"), false);
});

test("malformed voice candidates are rejected", () => {
  const result = normalizeVoicePantryItems([
    null,
    { name: "   ", quantity: 1, unit: "pcs" },
  ]);

  assert.deepEqual(result, { accepted: [], rejectedCount: 2 });
});
