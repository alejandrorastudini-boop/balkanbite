import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("ambiguous pantry edit transport failure never claims stock definitely stayed unchanged", () => {
  const start = app.indexOf("const dispatchVerifiedPantryChange");
  const end = app.indexOf("const handleUpdatePantryQuantity", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.match(block, /A transport failure can be ambiguous after commit/);
  assert.doesNotMatch(block, /No hemos modificado las existencias/);
  assert.doesNotMatch(block, /Your stock has not been changed/);
  assert.doesNotMatch(block, /Наличностите не са променени/);
  assert.match(block, /No se pudo confirmar el resultado del cambio/);
  assert.match(block, /Review the synchronized stock before trying again/);
  assert.match(block, /pendingSignedInDerivedReconciliations\.current\.set/);
});
