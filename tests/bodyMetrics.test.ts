import assert from "node:assert/strict";
import test from "node:test";
import { calculateBmi, formatBmi } from "../src/utils/bodyMetrics";

test("BMI is derived deterministically from centimetres and kilograms", () => {
  const bmi = calculateBmi(180, 81);
  assert.ok(bmi !== null);
  assert.ok(Math.abs(bmi - 25) < 0.000001);
  assert.equal(formatBmi(180, 81), "25.0");
});

test("BMI stays unknown unless both positive finite inputs are known", () => {
  assert.equal(calculateBmi(undefined, 70), null);
  assert.equal(calculateBmi(175, undefined), null);
  assert.equal(calculateBmi(0, 70), null);
  assert.equal(calculateBmi(175, -1), null);
  assert.equal(calculateBmi(Number.NaN, 70), null);
});
