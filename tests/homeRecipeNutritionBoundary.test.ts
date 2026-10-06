import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/HomeView.tsx", "utf8");

test("Home never reads the nonexistent caloriesKcal recipe field", () => {
  assert.doesNotMatch(source, /recipe\.caloriesKcal/);
});

test("Home preserves provenance when rendering recipe calories", () => {
  assert.match(source, /recipe\.nutritionDataStatus === "verified"/);
  assert.match(source, /"≈" \+ recipe\.calories/);
});
