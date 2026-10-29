import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");

test("a different guest tab changing pantry raises a permanent review latch", () => {
  assert.match(app, /const \[guestCrossTabPantryStale, setGuestCrossTabPantryStale\] = useState\(false\)/);
  assert.match(app, /event\.storageArea !== localStorage \|\| event\.key !== GUEST_PANTRY_KEY/);
  assert.match(app, /event\.newValue !== JSON\.stringify\(guestPantryCommittedRef\.current\)/);
  assert.match(app, /setGuestCrossTabPantryStale\(true\)/);
  assert.match(app, /window\.addEventListener\("storage", onGuestPantryStorageChanged\)/);
  assert.match(app, /window\.removeEventListener\("storage", onGuestPantryStorageChanged\)/);
  assert.doesNotMatch(app, /setGuestCrossTabPantryStale\(false\)/,
    "unrelated guest writes must not clear the cross-tab review requirement");
});
test("stale guest pantry blocks authoritative inventory and mutation, not unrelated menu facts", () => {
  assert.match(app, /const guestPantryReviewPending = !currentUser &&\s*\(guestCrossTabPantryStale \|\|/);
  assert.match(app, /if \(guestCrossTabPantryStale\) \{[\s\S]*?This edit was not saved/);
  assert.match(app, /guestCrossTabPantryStale \|\| guestPantryRecovery !== "none"/);
  const start = app.indexOf("const getAuthoritativeChefMealPlan =");
  const end = app.indexOf("const getAuthoritativeChefProgress =", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(app.slice(start, end), /guestCrossTabPantryStale/,
    "verified menu-only reads must remain independent of unrelated pantry changes");
  assert.match(app, /data-testid="guest-pantry-cross-tab-warning"/);
});
test("real two-tab Chromium evidence requires proactive warning before stale inventory edit", () => {
  assert.match(runtime, /getByTestId\("guest-pantry-cross-tab-warning"\)/);
  assert.match(runtime, /two-tabs-guest-pantry-proactive-storage-event-warning-before-edit/);
  assert.match(runtime, /assert\.equal\(JSON\.parse\(savedBeforeEdit\)\[0\]\.quantity, 550\)/);
});
