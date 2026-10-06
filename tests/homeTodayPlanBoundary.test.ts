import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/HomeView.tsx", "utf8");

test("Home does not substitute another plan day for today", () => {
  assert.doesNotMatch(source, /mealPlan\[dayOfWeek\]/);
  assert.doesNotMatch(source, /mealPlan\[0\]/);
  assert.match(source, /findPlannedMealForDate\(mealPlan, todayIsoDate\)/);
});

test("Home meal count comes from deterministic planned-slot evidence", () => {
  assert.match(source, /\{todayPlanEvidence\.plannedCount\}/);
  assert.doesNotMatch(source, /todayPlan\?\.lunch \|\| todayPlan\?\.dinner/);
});
