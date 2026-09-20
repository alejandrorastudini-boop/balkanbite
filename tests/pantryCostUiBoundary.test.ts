import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url),
  "utf8",
);

test("PantryView uses deterministic cost guards for totals and rows", () => {
  assert.match(source, /summarizePantryCosts\(pantry\)\.totalEUR/);
  assert.match(source, /knownPantryCostEUR\(item\.estimatedCostEUR\)/);
  assert.match(source, /itemCostEUR !== null/);
});

test("PantryView never calls toFixed directly on nullable pantry cost state", () => {
  assert.doesNotMatch(source, /item\.estimatedCostEUR\.toFixed/);
  assert.doesNotMatch(source, /estimatedCostEUR\s*\?\?\s*0/);
});
