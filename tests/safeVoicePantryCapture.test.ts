import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVoicePantryItems } from "../src/utils/safeVoicePantryCapture";

test("voice pantry capture preserves supplied facts without inventing optional values", () => {
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
        nameBg: "кисело мляко",
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

test("voice pantry capture keeps explicit zero cost/expiry and rejects malformed candidates", () => {
  const result = normalizeVoicePantryItems([
    {
      name: "Salt",
      quantity: 1,
      unit: "pack",
      category: "spice",
      shelfLifeDays: 0,
      estimatedCostEUR: 0,
    },
    null,
    { name: "   ", quantity: 1, unit: "pcs" },
  ]);

  assert.deepEqual(result, {
    accepted: [
      {
        name: "Salt",
        nameBg: "Salt",
        quantity: 1,
        unit: "pack",
        category: "Spices",
        expiryDaysLeft: 0,
        estimatedCostEUR: 0,
      },
    ],
    rejectedCount: 2,
  });
});
