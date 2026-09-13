import test from "node:test";
import assert from "node:assert/strict";
import { hasExplicitReconciliationEvidence } from "../src/utils/reconciliationEvidence";

test("accepts explicit matching numeric quantity and count unit aliases", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Aguacates", quantity: 2, unit: "uds" },
      "También compré 2 unidades de aguacate"
    ),
    true
  );
});

test("rejects vague extras even if provider invents quantity and unit", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Aguacates", quantity: 1, unit: "uds" },
      "También compré aguacates"
    ),
    false
  );
});

test("rejects explicit quantity when unit is missing from transcript", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Aguacates", quantity: 2, unit: "uds" },
      "También compré 2 aguacates"
    ),
    false
  );
});

test("rejects explicit unit when numeric quantity is missing", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Arroz", quantity: 1, unit: "kg" },
      "También compré arroz en kg"
    ),
    false
  );
});

test("rejects a provider default that disagrees with the explicit quantity", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Aguacates", quantity: 1, unit: "uds" },
      "También compré 2 uds de aguacates"
    ),
    false
  );
});

test("requires the same canonical unit, not merely a compatible dimension", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Arroz", quantity: 0.5, unit: "kg" },
      "Compré 500 g de arroz"
    ),
    false
  );
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Arroz", quantity: 500, unit: "g" },
      "Compré 500 gramos de arroz"
    ),
    true
  );
});

test("supports Bulgarian and English aliases through the shared unit normalizer", () => {
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Яйца", quantity: 6, unit: "бр" },
      "Купих 6 броя яйца"
    ),
    true
  );
  assert.equal(
    hasExplicitReconciliationEvidence(
      { name: "Milk", quantity: 2, unit: "L" },
      "Bought 2 liters of milk"
    ),
    true
  );
});
