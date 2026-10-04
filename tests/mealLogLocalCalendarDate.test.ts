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
