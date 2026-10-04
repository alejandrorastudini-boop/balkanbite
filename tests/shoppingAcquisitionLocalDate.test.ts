import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("shopping transfer derives pantry acquisition date from the local calendar", () => {
  const start = app.indexOf("const handleTransferToPantry");
  const end = app.indexOf("const handle", start + 30);
  const block = app.slice(start, end);
  assert.match(block, /localCalendarDate\(new Date\(occurredAt\)\)/);
  assert.doesNotMatch(block, /occurredAt\.split\("T"\)\[0\]/);
});

test("confirmed shopping reconciliation uses the same local acquisition-date boundary", () => {
  const start = app.indexOf("const handleReconcileShopping");
  const end = app.indexOf("const handle", start + 30);
  const block = app.slice(start, end);
  assert.match(block, /localCalendarDate\(new Date\(occurredAt\)\)/);
  assert.doesNotMatch(block, /occurredAt\.split\("T"\)\[0\]/);
});
