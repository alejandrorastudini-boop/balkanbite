import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync("src/App.tsx", "utf8");

test("guest app protects the original local pantry before rewriting the cache", () => {
  assert.match(app, /loadGuestPantry\(localStorage\.getItem\(GUEST_PANTRY_KEY\)\)/);
  assert.match(app, /writeGuestPantrySafely\(localStorage, nextPantry, guestPantryCommittedRef\.current\)/);
  assert.match(app, /writeGuestPantrySafely\(localStorage, inspected\.items\)/);
  assert.doesNotMatch(app, /writeGuestPantrySafely\(localStorage, pantry\)/);
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
  const guestTransition = app.indexOf("setPantry(loadedGuestPantry);");
  assert.ok(signedInTransition >= 0 && guestTransition > signedInTransition);
  assert.match(app.slice(signedInTransition, guestTransition), /setGuestPantryRecoveryAcknowledged\(false\)/);
  assert.match(app.slice(guestTransition, guestTransition + 160), /setGuestPantryRecoveryAcknowledged\(false\)/);
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

test("guest pantry mutations commit storage before any React or derived-state update", () => {
  const guard = app.indexOf("const commitGuestPantry = (");
  const end = app.indexOf("const updatePantryAndReconcileMenu =", guard);
  assert.ok(guard >= 0 && end > guard);
  const commit = app.slice(guard, end);
  const write = commit.indexOf("writeGuestPantrySafely(localStorage, nextPantry, guestPantryCommittedRef.current)");
  const fail = commit.indexOf("if (!result.saved)");
  const publish = commit.indexOf("setPantry(nextPantry)");
  const derived = commit.indexOf("reconcileGuestPantryDerivedState(nextPantry");
  assert.ok(write >= 0 && fail > write && publish > fail && derived > publish);
  assert.match(commit.slice(fail, publish), /return false;/);

  for (const expected of [
    "return updatePantryAndReconcileMenu([newItem], true)",
    "return updatePantryAndReconcileMenu(newItems, true)",
    "commitGuestPantry(updatedPantry)",
    "return commitGuestPantry([], { reconcile: false })",
    "if (!commitGuestPantry(result.pantry)) return { success: false, issueCount: 1 }",
    "if (!commitGuestPantry(preview.pantry)) return",
    "return commitGuestPantry(guestResult.pantry)",
  ]) {
    assert.ok(app.includes(expected), `missing commit-first guest route: ${expected}`);
  }
  assert.doesNotMatch(app, /setPantry\(\(prev\) => \{\s*const updatedPantry/);
  assert.doesNotMatch(app, /setPantry\(preview\.pantry\)/);
});

test("guest pantry commit rejects stale multi-tab state without publishing it", () => {
  const start = app.indexOf("const commitGuestPantry = (");
  const end = app.indexOf("const updatePantryAndReconcileMenu =", start);
  const commit = app.slice(start, end);
  assert.match(commit, /writeGuestPantrySafely\(localStorage, nextPantry, guestPantryCommittedRef\.current\)/);
  assert.match(commit, /result\.reason === "stale-snapshot"/);
  assert.match(commit, /Reload to review the current stock/);
  const refused = commit.indexOf("if (!result.saved)");
  const published = commit.indexOf("guestPantryCommittedRef.current = nextPantry");
  assert.ok(refused >= 0 && published > refused);
  assert.match(commit.slice(refused, published), /return false/);
});
