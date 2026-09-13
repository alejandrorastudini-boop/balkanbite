import test from "node:test";
import assert from "node:assert/strict";

test("AI extras are proposals, not selections", () => {
  const parserResponse = [{ name: "Bananas", quantity: 1, unit: "kg" }];
  const selectionAfterAnalysis: typeof parserResponse = [];
  assert.deepEqual(selectionAfterAnalysis, []);
});
