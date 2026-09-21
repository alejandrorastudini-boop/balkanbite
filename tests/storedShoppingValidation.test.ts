import assert from "node:assert/strict";
import test from "node:test";
import {
  isStoredShoppingItemStructurallyValid,
  parseStoredShoppingCache,
} from "../src/utils/storedShoppingValidation";

const baseItem = {
  id: "shop-1",
  name: "Beans",
  quantity: 2,
  unit: "pcs",
  category: "Pantry/Grains",
  checked: false,
  amountOrigin: "user_entered" as const,
  purchaseAmountConfirmed: false,
  reason: "Weekly staples",
};

test("complete shopping rows satisfy the persisted boundary", () => {
  assert.equal(isStoredShoppingItemStructurallyValid(baseItem), true);
  assert.equal(
    isStoredShoppingItemStructurallyValid({
      ...baseItem,
      category: "",
      estimatedPriceEUR: 0,
    }),
    true,
  );
});

test("legacy checked row without purchase confirmation stays visible but unconfirmed", () => {
  const {
    purchaseAmountConfirmed: _purchaseAmountConfirmed,
    ...legacyChecked
  } = { ...baseItem, checked: true };

  assert.equal(isStoredShoppingItemStructurallyValid(legacyChecked), true);
  const parsed = parseStoredShoppingCache(JSON.stringify([legacyChecked]));
  assert.equal(parsed?.[0]?.checked, true);
  assert.equal(parsed?.[0]?.purchaseAmountConfirmed, undefined);
});

test("mixed cache keeps valid rows and quarantines malformed rows", () => {
  const parsed = parseStoredShoppingCache(
    JSON.stringify([
      baseItem,
      { ...baseItem, id: "bad/id" },
      { ...baseItem, name: "   " },
      { ...baseItem, quantity: 0 },
      { ...baseItem, unit: "" },
      { ...baseItem, checked: "yes" },
    ]),
  );

  assert.deepEqual(parsed, [baseItem]);
});

test("invalid optional price and provenance fields are rejected", () => {
  for (const candidate of [
    { ...baseItem, estimatedPriceEUR: Number.NaN },
    { ...baseItem, estimatedPriceEUR: Number.POSITIVE_INFINITY },
    { ...baseItem, estimatedPriceEUR: -1 },
    { ...baseItem, amountOrigin: "model_guess" },
    { ...baseItem, purchaseAmountConfirmed: "yes" },
    { ...baseItem, reason: 42 },
  ]) {
    assert.equal(isStoredShoppingItemStructurallyValid(candidate), false);
  }
});

test("required shopping fields must be explicit and finite", () => {
  for (const candidate of [
    { ...baseItem, id: "" },
    { ...baseItem, name: "" },
    { ...baseItem, quantity: Number.NaN },
    { ...baseItem, quantity: Number.POSITIVE_INFINITY },
    { ...baseItem, quantity: -1 },
    { ...baseItem, unit: "" },
    { ...baseItem, category: undefined },
    { ...baseItem, checked: undefined },
  ]) {
    assert.equal(isStoredShoppingItemStructurallyValid(candidate), false);
  }
});

test("missing or malformed top-level cache remains unresolved", () => {
  assert.equal(parseStoredShoppingCache(null), null);
  assert.equal(parseStoredShoppingCache("{bad json"), null);
  assert.equal(parseStoredShoppingCache(JSON.stringify(baseItem)), null);
  assert.deepEqual(parseStoredShoppingCache("[]"), []);
});
