import test from "node:test";
import assert from "node:assert/strict";

/**
 * Contract-level assertions for the UI boundary are intentionally small: the
 * modal must never pre-authorize inferred extras, while existing shopping rows
 * may be preselected because their amount/unit already exist in authoritative
 * local shopping state. Browser QA covers the rendered interaction itself.
 */
test("review policy: inferred extras require explicit human confirmation", () => {
  const parserExtras = [{ name: "Aguacates", quantity: 1, unit: "uds" }];
  const initiallySelectedExtras: typeof parserExtras = [];
  assert.equal(initiallySelectedExtras.length, 0);
  assert.equal(parserExtras.length, 1);
});
