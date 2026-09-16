import assert from "node:assert/strict";
import test from "node:test";

import { validateManualPantryRequiredFields } from "../src/utils/manualPantryValidation";

test("manual pantry entries require an explicit positive quantity and unit", () => {
  assert.deepEqual(
    validateManualPantryRequiredFields({ quantity: "", unit: "kg" }),
    { valid: false }
  );
  assert.deepEqual(
    validateManualPantryRequiredFields({ quantity: "1", unit: "" }),
    { valid: false }
  );
  assert.deepEqual(
    validateManualPantryRequiredFields({ quantity: "0", unit: "kg" }),
    { valid: false }
  );
});

test("blank optional values remain absent instead of becoming invented defaults", () => {
  assert.deepEqual(
    validateManualPantryRequiredFields({
      quantity: " 2.5 ",
      unit: " kg ",
      expiryDays: "",
      cost: "",
    }),
    { valid: true, quantity: 2.5, unit: "kg" }
  );
});

test("explicit valid optional values are retained and invalid values are rejected", () => {
  assert.deepEqual(
    validateManualPantryRequiredFields({
      quantity: "2",
      unit: "kg",
      expiryDays: "3",
      cost: "4.5",
    }),
    { valid: true, quantity: 2, unit: "kg", expiryDays: 3, cost: 4.5 }
  );
  assert.deepEqual(
    validateManualPantryRequiredFields({
      quantity: "2",
      unit: "kg",
      expiryDays: "-1",
    }),
    { valid: false }
  );
  assert.deepEqual(
    validateManualPantryRequiredFields({
      quantity: "2",
      unit: "kg",
      cost: "not-a-price",
    }),
    { valid: false }
  );
});
