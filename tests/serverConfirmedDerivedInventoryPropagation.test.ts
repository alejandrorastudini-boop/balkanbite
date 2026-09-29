import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("signed-in derived reconciliation is gated by server-confirmed inventory", () => {
  assert.match(app, /pendingSignedInDerivedReconciliations/);
  assert.match(
    app,
    /if \(!inventoryHydrated \|\| !inventoryServerConfirmed\) return;[\s\S]{0,900}reconcileCommittedPantryAvailability\(pantry, true\)/,
  );
});

test("manual signed-in edits register exact expected stock before persistence", () => {
  const start = app.indexOf("const dispatchVerifiedPantryChange");
  const end = app.indexOf("const handleUpdatePantryQuantity", start);
  const block = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /expectedRemaining: \{ \[viewed\.id\]: next === "remove" \? null : next \}/);
  assert.ok(
    block.indexOf("pendingSignedInDerivedReconciliations.current.set") <
      block.indexOf("submitInventoryEdit("),
  );
});

test("Clear-All registers absence evidence before authoritative clear", () => {
  const start = app.indexOf("const handleClearPantry");
  const end = app.indexOf("const handleClearRecipes", start);
  const block = app.slice(start, end);
  assert.match(block, /Object\.fromEntries\(pantry\.map\(item => \[item\.id, null\]\)\)/);
  assert.ok(
    block.indexOf("pendingSignedInDerivedReconciliations.current.set") <
      block.indexOf("submitInventoryClear("),
  );
});

test("confirmed cook registers only affected expected remaining lots", () => {
  const start = app.indexOf("const handleCookRecipe");
  const end = app.indexOf("const handleAddMissingToShopping", start);
  const block = app.slice(start, end);
  assert.match(block, /affectedIds = new Set\(prepared\.result\.deductions\.map/);
  assert.match(block, /remainingById\.has\(itemId\) \? remainingById\.get\(itemId\)! : null/);
  assert.ok(
    block.indexOf("pendingSignedInDerivedReconciliations.current.set") <
      block.indexOf("submitConfirmedCook("),
  );
});

test("account changes discard pending derived reconciliation evidence", () => {
  assert.match(
    app,
    /preparedSignedInCooks\.current\.clear\(\);\s*pendingSignedInDerivedReconciliations\.current\.clear\(\);/,
  );
});
