import assert from "node:assert/strict";
import test from "node:test";

import { validateManualPantryRequiredFields } from "../src/utils/manualPantryValidation";

test("manual pantry quantity and unit must be explicitly supplied", () => {
  assert.deepEqual(validateManualPantryRequiredFields({ quantity: "", unit: "kg" }), {
    valid: false,
    error: "quantity-required",
  });
  assert.deepEqual(validateManualPantryRequiredFields({ quantity: "1", unit: "" }), {
    valid: false,
    error: "unit-required",
  });
});

test("manual pantry quantity must be a positive finite number", () => {
  for (const quantity of ["0", "-1", "not a number", "Infinity"]) {
    assert.deepEqual(validateManualPantryRequiredFields({ quantity, unit: "kg" }), {
      valid: false,
      error: "quantity-invalid",
    });
  }
});

test("validated manual pantry fields preserve the confirmed unit", () => {
  assert.deepEqual(validateManualPantryRequiredFields({ quantity: " 1.5 ", unit: " бр. " }), {
    valid: true,
    quantity: 1.5,
    unit: "бр.",
  });
});
