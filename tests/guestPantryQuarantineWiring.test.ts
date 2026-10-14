import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync("src/App.tsx", "utf8");

test("guest app protects the original local pantry before rewriting the cache", () => {
  assert.match(app, /loadGuestPantry\(localStorage\.getItem\(GUEST_PANTRY_KEY\)\)/);
  assert.match(app, /writeGuestPantrySafely\(localStorage, pantry\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\("balkanbite_pantry", JSON\.stringify\(pantry\)\)/);
  assert.match(app, /setGuestPantryRecovery\(/);
});

test("guest recovery is visible, exportable and never uploaded by the recovery UI", () => {
  assert.match(app, /data-testid="guest-pantry-recovery"/);
  assert.match(app, /downloadGuestPantryRecovery/);
  assert.match(app, /GUEST_PANTRY_QUARANTINE_KEY/);
  assert.match(app, /data-testid="guest-pantry-download-previous-backup"/);
  assert.match(app, /downloadGuestPantryRecovery\("backup"\)/);
  assert.match(app, /new Blob\(\[raw\], \{ type: "application\/json" \}\)/);
  const start = app.indexOf("const downloadGuestPantryRecovery");
  const end = app.indexOf("  return (", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(app.slice(start, end), /fetch\(|navigator\.sendBeacon\(/);
});

test("guest inventory changes are gated on backup safety and explicit incomplete-stock review", () => {
  assert.match(app, /!currentUser && guestPantryRecovery === "blocked"/);
  assert.match(app, /La despensa de invitados está bloqueada para no perder datos antiguos/);
  assert.match(app, /guestPantryRecovery === "available" && !guestPantryRecoveryAcknowledged/);
  assert.match(app, /data-testid="guest-pantry-continue-verified"/);
  assert.match(app, /setGuestPantryRecoveryAcknowledged\(true\)/);
  assert.match(app, /Continuar solo con entradas validadas/);
});

test("guest recovery consent never survives signed-in and guest scope transitions", () => {
  const signedInTransition = app.indexOf("setPantry(cachedUserPantry ?? []);");
  const guestTransition = app.indexOf("setPantry(loadGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY)));");
  assert.ok(signedInTransition >= 0 && guestTransition > signedInTransition);
  assert.match(app.slice(signedInTransition, guestTransition), /setGuestPantryRecoveryAcknowledged\(false\)/);
  assert.match(app.slice(guestTransition, guestTransition + 140), /setGuestPantryRecoveryAcknowledged\(false\)/);
});


test("incomplete guest pantry suppresses derived shopping warnings and suggestions", () => {
  assert.match(app, /const pantryDerivedDataProvisional = inventoryIsProvisional \|\| guestPantryReviewPending/);
  assert.match(app, /if \(pantryDerivedDataProvisional\) return;/);
  assert.match(app, /pantryDerivedDataProvisional \? undefined : shoppingDiagnostic\.urgencyLevel/);
  assert.match(app, /\{!pantryDerivedDataProvisional && \(\s*<SmartShoppingBanner/);
  const start = app.indexOf("const handleAddMultipleShoppingItems = async");
  const end = app.indexOf("const handle", start + 10);
  assert.ok(start >= 0 && end > start);
  assert.match(app.slice(start, end), /if \(!requireAuthoritativeInventory\(\)\) return false;/);
});
