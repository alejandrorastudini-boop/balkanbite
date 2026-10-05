import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { localCalendarDate } from "../src/utils/effectiveExpiry";

test("local calendar date reflects local components rather than UTC slicing", () => {
  const localLateNight = new Date(2026, 9, 5, 0, 30, 0, 0);
  assert.equal(localCalendarDate(localLateNight), "2026-10-05");
});

test("meal log keeps ISO timestamp but uses shared local calendar bucket", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const start = app.indexOf("const handleLogMeal");
  const end = app.indexOf("const handleGenerateAiShopping", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);

  assert.match(handler, /const instant = new Date\(\);/);
  assert.match(handler, /const timestamp = instant\.toISOString\(\);/);
  assert.match(handler, /const date = localCalendarDate\(instant\);/);
  assert.match(handler, /if \(!date\) return false;/);
  assert.doesNotMatch(handler, /split\("T"\)\[0\]/);
});


test("calendar keys parse as local dates without UTC reinterpretation", async () => {
  const { localDateFromCalendarKey } = await import("../src/utils/effectiveExpiry");
  const parsed = localDateFromCalendarKey("2026-10-05");
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 9);
  assert.equal(parsed.getDate(), 5);
  assert.equal(localDateFromCalendarKey("2026-02-30"), null);
});

test("meal plan view does not use UTC slicing for local day identity", () => {
  const view = fs.readFileSync("src/components/MealPlanView.tsx", "utf8");
  assert.doesNotMatch(view, /toISOString\(\)\.split\("T"\)\[0\]/);
  assert.match(view, /localCalendarDate\(selectedDate\)/);
  assert.match(view, /localCalendarDate\(day\)/);
  assert.match(view, /localDateFromCalendarKey\(day\.date\)/);
});


test("invalid stored plan date is not rendered as today's date", () => {
  const view = fs.readFileSync("src/components/MealPlanView.tsx", "utf8");
  assert.doesNotMatch(view, /localDateFromCalendarKey\(day\.date\) \|\| new Date\(\)/);
  assert.match(view, /: "—";/);
});
