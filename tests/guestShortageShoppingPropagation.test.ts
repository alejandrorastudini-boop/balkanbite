import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("guest pantry reconciliation propagates verified shortfalls into managed shopping rows", () => {
  const start = app.indexOf("const reconcileGuestPantryDerivedState");
  const end = app.indexOf("// Signed-in stock commands", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.match(block, /evaluateShoppingNeeds/);
  assert.match(block, /reconcileDerivedShortageShoppingItems/);
  assert.match(block, /setShoppingList/);
});

test("guest shortage propagation uses the current shopping baseline", () => {
  const start = app.indexOf("const reconcileGuestPantryDerivedState");
  const end = app.indexOf("// Signed-in stock commands", start);
  const block = app.slice(start, end);
  assert.ok(block.includes("updatedPantry, newPlan, current, profile.language"));
  assert.equal(block.includes("updatedPantry, newPlan, shoppingList, profile.language"), false);
});
