import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("automatic shortage reconciliation waits for authoritative inventory", () => {
  const start = app.indexOf("const derivedShortageReconcileFingerprint");
  const end = app.indexOf("const currentFingerprint = buildAdvisorBatchFingerprint", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.match(block, /if \(!currentUser \|\| inventoryIsProvisional \|\| !inventoryServerConfirmed\) return/);
  assert.match(block, /submitDerivedShortageReconciliation/);
  assert.equal(block.includes("setShoppingList("), false);
});

test("signed-in shortage writer requires hydrated shopping authority", () => {
  const start = hook.indexOf("const submitDerivedShortageReconciliation");
  const end = hook.indexOf("const submitShoppingItemCreate", start);
  assert.ok(start >= 0 && end > start);
  const block = hook.slice(start, end);
  assert.match(block, /hydratedCollectionUser\.current\.shoppingList !== uid/);
  assert.match(block, /shoppingList\.filter\(isManagedDerivedShortageRow\)/);
  assert.match(block, /reconcileDerivedShortagesAtomically/);
});

test("automatic reconciliation never treats a persistence failure as local success", () => {
  const start = app.indexOf("const derivedShortageReconcileFingerprint");
  const end = app.indexOf("const currentFingerprint = buildAdvisorBatchFingerprint", start);
  const block = app.slice(start, end);
  assert.match(block, /\.catch\(error =>/);
  assert.equal(block.includes("setShoppingList("), false);
});
