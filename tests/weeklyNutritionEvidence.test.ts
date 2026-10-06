import assert from "node:assert/strict";
import test from "node:test";
import type { MealLog } from "../src/types";
import { summarizeSevenDayNutritionEvidence } from "../src/utils/weeklyNutritionEvidence";

const log = (id: string, date: string, verified = true): MealLog => ({
  id,
  date,
  mealType: "lunch",
  timestamp: date + "T12:00:00+03:00",
  nutritionDataStatus: verified ? "verified" : "estimated",
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
});

test("seven-day evidence includes exactly the local-date window", () => {
  const result = summarizeSevenDayNutritionEvidence([
    log("old", "2026-09-29"),
    log("start", "2026-09-30"),
    log("mid", "2026-10-03"),
    log("end", "2026-10-06"),
    log("future", "2026-10-07"),
  ], "2026-10-06");
  assert.equal(result.startDate, "2026-09-30");
  assert.equal(result.verifiedLogCount, 3);
  assert.equal(result.daysWithVerifiedNutrition, 3);
  assert.equal(result.totals?.calories, 1500);
});

test("unverified logs remain visible as evidence gaps and never enter totals", () => {
  const result = summarizeSevenDayNutritionEvidence([
    log("verified", "2026-10-06"),
    log("estimated", "2026-10-05", false),
  ], "2026-10-06");
  assert.equal(result.verifiedLogCount, 1);
  assert.equal(result.unverifiedLogCount, 1);
  assert.equal(result.daysWithVerifiedNutrition, 1);
  assert.equal(result.totals?.calories, 500);
});

test("no verified nutrition produces null totals rather than authoritative zero", () => {
  const result = summarizeSevenDayNutritionEvidence([
    log("estimated", "2026-10-06", false),
  ], "2026-10-06");
  assert.equal(result.totals, null);
  assert.equal(result.unverifiedLogCount, 1);
});
