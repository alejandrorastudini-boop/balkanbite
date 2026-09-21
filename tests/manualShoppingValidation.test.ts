import assert from "node:assert/strict";
import test from "node:test";
import { hasValidManualShoppingRequiredFields } from "../src/utils/manualShoppingValidation";

test("manual shopping requires explicit name quantity and unit", () => {
  assert.equal(
    hasValidManualShoppingRequiredFields({
      name: "Tomatoes",
      quantity: 2,
      unit: "kg",
    }),
    true,
  );

  for (const candidate of [
    { name: "", quantity: 2, unit: "kg" },
    { name: "Tomatoes", quantity: 0, unit: "kg" },
    { name: "Tomatoes", quantity: -1, unit: "kg" },
    { name: "Tomatoes", quantity: Number.NaN, unit: "kg" },
    { name: "Tomatoes", quantity: Number.POSITIVE_INFINITY, unit: "kg" },
    { name: "Tomatoes", quantity: 2, unit: "" },
  ]) {
    assert.equal(hasValidManualShoppingRequiredFields(candidate), false);
  }
});
