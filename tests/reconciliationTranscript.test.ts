import test from "node:test";
import assert from "node:assert/strict";
import {
  extractExplicitReconciliationAmount,
  sanitizeReconciliationExtrasForReview,
} from "../src/utils/reconciliationTranscript";

test("extracts explicit count quantity and unit from Spanish transcript", () => {
  assert.deepEqual(
    extractExplicitReconciliationAmount(
      "Compré 2 uds de aguacate",
      ["Aguacates", "aguacate"],
      1
    ),
    { quantity: 2, unit: "uds" }
  );
});

test("supports decimal comma and compatible mass alias", () => {
  assert.deepEqual(
    extractExplicitReconciliationAmount(
      "Compré 0,5 kg de plátano",
      ["Plátanos", "plátano"],
      1
    ),
    { quantity: 0.5, unit: "kg" }
  );
});

test("rejects vague extra without quantity and unit", () => {
  assert.equal(
    extractExplicitReconciliationAmount("Compré aguacate", ["Aguacates"], 1),
    null
  );
});

test("rejects quantity without an explicit unit", () => {
  assert.equal(
    extractExplicitReconciliationAmount("Compré 2 aguacates", ["Aguacates"], 1),
    null
  );
});

test("rejects unit without an explicit numeric quantity", () => {
  assert.equal(
    extractExplicitReconciliationAmount("Compré uds de aguacate", ["Aguacates"], 1),
    null
  );
});

test("supports English and Bulgarian unit aliases", () => {
  assert.deepEqual(
    extractExplicitReconciliationAmount("Bought 2 units of avocado", ["Avocado"], 1),
    { quantity: 2, unit: "uds" }
  );
  assert.deepEqual(
    extractExplicitReconciliationAmount("Купих 6 броя яйца", ["Яйца"], 1),
    { quantity: 6, unit: "uds" }
  );
});

test("multiple extras require a nearby amount rather than arbitrary pairing", () => {
  assert.deepEqual(
    extractExplicitReconciliationAmount(
      "Compré 2 uds de aguacate y 500 g de arroz",
      ["Aguacates", "aguacate"],
      2
    ),
    { quantity: 2, unit: "uds" }
  );
  assert.deepEqual(
    extractExplicitReconciliationAmount(
      "Compré 2 uds de aguacate y 500 g de arroz",
      ["Arroz"],
      2
    ),
    { quantity: 500, unit: "g" }
  );
});

test("sanitizer discards provider defaults, price and expiry and keeps transcript amount only", () => {
  assert.deepEqual(
    sanitizeReconciliationExtrasForReview(
      [{
        name: "Aguacates",
        quantity: 1,
        unit: "kg",
        category: "Produce",
        estimatedCostEUR: 9.99,
        expiryDaysLeft: 7,
      }],
      "Compré 2 uds de aguacate"
    ),
    [{ name: "Aguacates", category: "Produce", quantity: 2, unit: "uds" }]
  );
});

test("sanitizer blocks vague provider proposal by removing fabricated amount metadata", () => {
  assert.deepEqual(
    sanitizeReconciliationExtrasForReview(
      [{
        name: "Aguacates",
        quantity: 1,
        unit: "uds",
        category: "Produce",
        estimatedCostEUR: 1.99,
        expiryDaysLeft: 7,
      }],
      "Compré aguacates"
    ),
    [{ name: "Aguacates", category: "Produce" }]
  );
});
