import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pantryView = readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url),
  "utf8",
);
const planner = readFileSync(
  new URL("../src/utils/menuAutoPlanner.ts", import.meta.url),
  "utf8",
);

test("pantry UI derives current expiry instead of rendering stored relative days directly", () => {
  assert.match(pantryView, /derivePantryItemExpiry\(item, expiryNow\)/);
  assert.match(pantryView, /effectiveExpiry\.daysRemaining/);
  assert.match(pantryView, /effectiveExpiry\.expired/);
  assert.doesNotMatch(
    pantryView,
    /\{item\.expiryDaysLeft\}\s*\{currentText\.shelfLifeDays\}/,
  );
});

test("partial merged expiry is review-only rather than exact UI precision", () => {
  assert.match(pantryView, /Partial expiry: review/);
  assert.match(pantryView, /Caducidad parcial: revisar/);
  assert.match(pantryView, /Частичен срок: преглед/);
});

test("planner uses effective expiry and excludes already-past evidence from anti-waste bonus", () => {
  assert.match(planner, /derivePantryItemExpiry\(item, now\)/);
  assert.match(planner, /!expiry\.expired/);
  assert.match(planner, /expiry\.daysRemaining <= 5/);
});
