import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../src/components/HomeView.tsx", import.meta.url), "utf8");
const pantry = readFileSync(new URL("../src/components/PantryView.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useLocalCalendarDay.ts", import.meta.url), "utf8");

test("home and pantry share reactive local calendar authority", () => {
  assert.match(home, /useLocalCalendarDay\(\)/);
  assert.match(pantry, /useLocalCalendarDay\(\)/);
  assert.match(home, /derivePantryItemExpiry\(item, now\)/);
  assert.doesNotMatch(home, /new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/);
});

test("local calendar hook refreshes at rollover and foreground without polling", () => {
  assert.match(hook, /millisecondsUntilNextLocalDay\(\)/);
  assert.match(hook, /setTimeout\(refresh, delay \+ 50\)/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /"focus"/);
  assert.doesNotMatch(hook, /setInterval/);
});
