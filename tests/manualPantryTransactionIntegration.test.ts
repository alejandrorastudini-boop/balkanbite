import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const pantrySource = readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url), "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("pantry +/- and delete dispatch the exact rendered item as click-time evidence", () => {
  assert.match(
    pantrySource,
    /onDeleteItem\(item\.id, item\)/,
  );
  assert.match(
    pantrySource,
    /onUpdateQuantity\(\s*item\.id,[\s\S]{0,140}item\s*\)/,
  );
});

test("signed-in manual quantity edit does not optimistically mutate local pantry", () => {
  const start = appSource.indexOf("const handleUpdatePantryQuantity");
  const end = appSource.indexOf("const handleDeletePantryItem", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(
    handler,
    /if \(currentUser\) \{\s*dispatchVerifiedPantryChange\(viewed, newQty\);\s*return;\s*\}/,
  );
  const signedInBlock = handler.slice(
    handler.indexOf("if (currentUser)"),
    handler.indexOf("setPantry"),
  );
  assert.doesNotMatch(signedInBlock, /setPantry\(/);
  assert.match(handler, /setPantry\(\(prev\) =>/);
});

test("signed-in manual delete waits for committed remote snapshot while guest delete stays local", () => {
  const start = appSource.indexOf("const handleDeletePantryItem");
  const end = appSource.indexOf("const handleClearPantry", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(
    handler,
    /if \(currentUser\) \{\s*dispatchVerifiedPantryChange\(viewed, "remove"\);\s*return;\s*\}/,
  );
  assert.match(handler, /setPantry\(\(prev\) => prev\.filter/);
});

test("hook performs verified transaction and does not directly set pantry after commit", () => {
  const start = syncSource.indexOf("const submitInventoryEdit");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const submit = syncSource.slice(start, end);
  assert.match(submit, /submitVerifiedPantryEdit\(/);
  assert.match(submit, /persistVerifiedInventoryAdjustment\(db, userId, expected, edit\)/);
  assert.doesNotMatch(submit, /setPantry\(/);
  assert.match(submit, /inFlightInventoryEdits\.current\.has\(viewed\.id\)/);
  assert.match(submit, /finally \{[\s\S]*inFlightInventoryEdits\.current\.delete\(viewed\.id\)/);
});

test("manual signed-in edit surfaces conflict and write failure instead of fabricating success", () => {
  const start = appSource.indexOf("const dispatchVerifiedPantryChange");
  const end = appSource.indexOf("const handleUpdatePantryQuantity", start);
  assert.ok(start >= 0 && end > start);
  const dispatch = appSource.slice(start, end);
  assert.match(dispatch, /result\.outcome !== "needs-review"/);
  assert.match(dispatch, /Manual pantry edit needs review/);
  assert.match(dispatch, /\.catch\(error =>/);
  assert.match(dispatch, /Verified manual pantry edit failed/);
});

test("signed-in manual path still requires authoritative inventory startup gate", () => {
  const updateStart = appSource.indexOf("const handleUpdatePantryQuantity");
  const deleteStart = appSource.indexOf("const handleDeletePantryItem", updateStart);
  const clearStart = appSource.indexOf("const handleClearPantry", deleteStart);
  assert.match(
    appSource.slice(updateStart, deleteStart),
    /if \(!requireAuthoritativeInventory\(\)\) return;/,
  );
  assert.match(
    appSource.slice(deleteStart, clearStart),
    /if \(!requireAuthoritativeInventory\(\)\) return;/,
  );
});
