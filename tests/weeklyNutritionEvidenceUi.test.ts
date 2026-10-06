import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const source = fs.readFileSync("src/components/HomeView.tsx", "utf8");
test("Home surfaces seven-day evidence without turning it into a nutrition target", () => {
  assert.match(source, /summarizeSevenDayNutritionEvidence/);
  assert.match(source, /data-testid="seven-day-nutrition-evidence"/);
  assert.match(source, /not a nutrition target/);
  assert.match(source, /no es un objetivo nutricional/);
  assert.match(source, /unverifiedLogCount/);
  assert.doesNotMatch(source, /weekly calorie target|weekly deficit|calorie budget/);
});
