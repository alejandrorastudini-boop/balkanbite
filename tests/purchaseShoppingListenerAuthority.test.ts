import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("signed-in purchase completion does not locally delete authoritative shopping rows", () => {
  const start = app.indexOf("const finalizeSignedInPurchaseIfVisible");
  const end = app.indexOf("const dispatchSignedInPurchaseApplication", start);
  assert.ok(start >= 0 && end > start);
  const finalize = app.slice(start, end);
  assert.doesNotMatch(finalize, /setShoppingList/);
  assert.match(finalize, /Shopping rows were retired in the same authoritative purchase transaction/);
});

test("already-applied purchase replay does not locally delete shopping rows", () => {
  const start = app.indexOf('if (persisted.outcome === "already-applied")');
  const end = app.indexOf("const sameNew", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(app.slice(start, end), /setShoppingList/);
});
