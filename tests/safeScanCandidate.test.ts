import test from "node:test";
import assert from "node:assert/strict";
import {
  isCandidateReadyForPantry,
  normalizeScanCandidate,
  normalizeScanCategory,
  toPantryPayload,
} from "../src/utils/safeScanCandidate";

test("preserves verified scan values without fabricating missing fields", () => {
  const candidate = normalizeScanCandidate({
    name: "  Yogurt  ",
    quantity: 2,
    unit: " cups ",
    category: "dairy",
    estimatedDaysUntilExpiry: 0,
    approximateCostEUR: 0,
    confidence: "medium",
  });

  assert.deepEqual(candidate, {
    name: "Yogurt",
    quantity: 2,
    unit: "cups",
    category: "Dairy",
    estimatedDaysUntilExpiry: 0,
    approximateCostEUR: 0,
    confidence: "medium",
  });
});

test("missing or invalid uncertain values stay unknown", () => {
  const candidate = normalizeScanCandidate({
    name: "Tomato",
    quantity: 0,
    unit: "   ",
    category: "unknown-category",
    estimatedDaysUntilExpiry: -1,
    approximateCostEUR: Number.NaN,
    confidence: "certain",
  });

  assert.deepEqual(candidate, {
    name: "Tomato",
    quantity: undefined,
    unit: undefined,
    category: undefined,
    estimatedDaysUntilExpiry: undefined,
    approximateCostEUR: undefined,
    confidence: undefined,
  });
  assert.equal(isCandidateReadyForPantry(candidate!), false);
  assert.equal(toPantryPayload(candidate!), null);
});

test("blank names are rejected and absent categories remain unknown", () => {
  assert.equal(normalizeScanCandidate({ name: "   " }), null);
  assert.equal(normalizeScanCategory(undefined), undefined);
  assert.equal(normalizeScanCategory("fresh herbs"), "Spices");
});

test("pantry payload requires confirmed quantity and unit while optional facts remain absent", () => {
  const candidate = normalizeScanCandidate({
    name: "Rice",
    quantity: 1.5,
    unit: "kg",
    category: "grain",
  });
  assert.ok(candidate);
  assert.equal(isCandidateReadyForPantry(candidate), true);
  const payload = toPantryPayload(candidate);
  assert.deepEqual(payload, {
    name: "Rice",
    quantity: 1.5,
    unit: "kg",
    category: "Pantry/Grains",
  });
  assert.equal(Object.hasOwn(payload!, "expiryDaysLeft"), false);
  assert.equal(Object.hasOwn(payload!, "estimatedCostEUR"), false);
});
