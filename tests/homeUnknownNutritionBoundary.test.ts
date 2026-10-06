import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/HomeView.tsx", "utf8");

test("Home does not coerce missing verified nutrition totals to zero", () => {
  assert.doesNotMatch(source, /totals\?\.calories \?\? 0/);
  assert.doesNotMatch(source, /totals\?\.protein \?\? 0/);
  assert.doesNotMatch(source, /totals\?\.carbs \?\? 0/);
  assert.doesNotMatch(source, /totals\?\.fat \?\? 0/);
  assert.match(source, /verifiedNutritionToday\.totals \? Math\.round/);
  assert.match(source, /: "—"/);
});
