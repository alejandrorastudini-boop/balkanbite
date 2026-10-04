import assert from "node:assert/strict";
import test from "node:test";
import { computeCookExpectedRemaining } from "../src/utils/cookExpectedRemaining";

test("cook expected remaining converts recipe grams into pantry kilograms", () => {
  assert.equal(
    computeCookExpectedRemaining("rice", 1, "kg", [
      { pantryItemId: "rice", quantity: 500, unit: "g" },
    ]),
    0.5,
  );
});

test("cook expected remaining sums multiple compatible allocations in base units", () => {
  assert.equal(
    computeCookExpectedRemaining("rice", 1, "kg", [
      { pantryItemId: "rice", quantity: 250, unit: "g" },
      { pantryItemId: "rice", quantity: 0.25, unit: "kg" },
    ]),
    0.5,
  );
});

test("cook expected remaining preserves exact custom-unit identity only", () => {
  assert.equal(
    computeCookExpectedRemaining("eggs", 6, "tray-slot", [
      { pantryItemId: "eggs", quantity: 2, unit: "tray-slot" },
    ]),
    4,
  );
  assert.equal(
    computeCookExpectedRemaining("eggs", 6, "tray-slot", [
      { pantryItemId: "eggs", quantity: 2, unit: "piece" },
    ]),
    null,
  );
});

test("cook expected remaining rejects incompatible, excessive, malformed, or absent allocations", () => {
  assert.equal(
    computeCookExpectedRemaining("milk", 1, "l", [
      { pantryItemId: "milk", quantity: 100, unit: "g" },
    ]),
    null,
  );
  assert.equal(
    computeCookExpectedRemaining("rice", 0.2, "kg", [
      { pantryItemId: "rice", quantity: 250, unit: "g" },
    ]),
    null,
  );
  assert.equal(
    computeCookExpectedRemaining("rice", 1, "kg", [
      { pantryItemId: "other", quantity: 250, unit: "g" },
    ]),
    null,
  );
});
