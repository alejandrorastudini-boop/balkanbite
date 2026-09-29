import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("signed-in manual add dispatches creation transaction instead of local pantry append", () => {
  const start = appSource.indexOf("const handleAddPantryItem");
  const end = appSource.indexOf("const handleAddMultiplePantryItems", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(handler, /if \(!currentUser\) \{[\s\S]*updatePantryAndReconcileMenu\(\[newItem\], true\);[\s\S]*return;/);
  assert.match(handler, /submitInventoryCreation\(\[newItem\]\)/);
  const signedIn = handler.slice(handler.indexOf("if (!currentUser)"));
  const afterGuest = signedIn.slice(signedIn.indexOf("return;") + 7);
  assert.doesNotMatch(afterGuest, /updatePantryAndReconcileMenu\(/);
  assert.doesNotMatch(afterGuest, /setPantry\(/);
});

test("manual add still validates required acquisition fields before transaction dispatch", () => {
  const start = appSource.indexOf("const handleAddPantryItem");
  const end = appSource.indexOf("const handleAddMultiplePantryItems", start);
  const handler = appSource.slice(start, end);
  const validation = handler.indexOf("hasValidPantryAcquisitionRequiredFields(item)");
  const creation = handler.indexOf("submitInventoryCreation([newItem])");
  assert.ok(validation >= 0 && creation > validation);
});

test("signed-in creation failures and review outcomes are visible, not fabricated success", () => {
  const start = appSource.indexOf("const handleAddPantryItem");
  const end = appSource.indexOf("const handleAddMultiplePantryItems", start);
  const handler = appSource.slice(start, end);
  assert.match(handler, /result\.outcome !== "needs-review"/);
  assert.match(handler, /Manual pantry creation needs review/);
  assert.match(handler, /\.catch\(error =>/);
  assert.match(handler, /Verified manual pantry creation failed/);
});

test("hook creation command requires current server-verified owner authority", () => {
  const start = syncSource.indexOf("const submitInventoryCreation");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const command = syncSource.slice(start, end);
  assert.match(command, /inventoryHydratedUser !== uid/);
  assert.match(command, /authSessionUserId\.current !== uid/);
  assert.match(command, /inventoryEditAuthority\.current\.status !== "verified"/);
  assert.match(command, /inventoryEditAuthority\.current\.userId !== uid/);
  assert.match(command, /persistNewInventoryItems\(db, uid, items\)/);
  assert.doesNotMatch(command, /setPantry\(/);
});

test("batch add remains explicitly unmigrated so narrow manual add scope cannot be overstated", () => {
  const start = appSource.indexOf("const handleAddMultiplePantryItems");
  const end = appSource.indexOf("const dispatchVerifiedPantryChange", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(handler, /updatePantryAndReconcileMenu\(newItems, true\)/);
  assert.doesNotMatch(handler, /submitInventoryCreation/);
});
