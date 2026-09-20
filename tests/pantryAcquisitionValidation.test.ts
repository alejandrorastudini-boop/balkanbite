import assert from "node:assert/strict";
import test from "node:test";
import {
  hasValidPantryAcquisitionRequiredFields,
  isValidPantryAcquisitionBatch,
} from "../src/utils/pantryAcquisitionValidation";

test("pantry acquisition requires explicit name, positive finite quantity and unit", () => {
  assert.equal(
    hasValidPantryAcquisitionRequiredFields({
      name: "Rice",
      quantity: 1,
      unit: "kg",
    }),
    true,
  );

  for (const item of [
    { name: "", quantity: 1, unit: "kg" },
    { name: "   ", quantity: 1, unit: "kg" },
    { name: "Rice", quantity: 0, unit: "kg" },
    { name: "Rice", quantity: -1, unit: "kg" },
    { name: "Rice", quantity: Number.NaN, unit: "kg" },
    { name: "Rice", quantity: Number.POSITIVE_INFINITY, unit: "kg" },
    { name: "Rice", quantity: 1, unit: "" },
    { name: "Rice", quantity: 1, unit: "   " },
  ]) {
    assert.equal(hasValidPantryAcquisitionRequiredFields(item), false);
  }
});

test("batch acquisition is all-or-nothing and non-empty", () => {
  assert.equal(isValidPantryAcquisitionBatch([]), false);
  assert.equal(
    isValidPantryAcquisitionBatch([
      { name: "Rice", quantity: 1, unit: "kg" },
      { name: "Milk", quantity: 1, unit: "L" },
    ]),
    true,
  );
  assert.equal(
    isValidPantryAcquisitionBatch([
      { name: "Rice", quantity: 1, unit: "kg" },
      { name: "Broken", quantity: 0, unit: "pcs" },
    ]),
    false,
  );
});
