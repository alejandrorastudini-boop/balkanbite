import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const browser = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");

test("external recipe/menu/progression changes and storage.clear latch a guest review warning", () => {
  assert.match(app, /const \[guestCrossTabDerivedStale, setGuestCrossTabDerivedStale\] = useState\(false\)/);
  for (const key of ["balkanbite_recipes","balkanbite_mealplan","balkanbite_progression"]) {
    assert.ok(app.includes(`"${key}"`));
  }
  assert.match(app, /event\.key === null \|\|[\s\S]*?\.includes\(event\.key\) && event\.newValue !== event\.oldValue/);
  assert.match(app, /setGuestCrossTabDerivedStale\(true\)/);
  assert.doesNotMatch(app, /setGuestCrossTabDerivedStale\(false\)/);
  assert.match(app, /window\.addEventListener\("storage", onGuestDerivedStorageChanged\)/);
  assert.match(app, /window\.removeEventListener\("storage", onGuestDerivedStorageChanged\)/);
});
test("derived writes and recovery never overwrite another tab's source", () => {
  for (const writer of ["recipes", "mealPlan", "progressionLedger"]) {
    const start = app.indexOf(`const serialized = JSON.stringify(${writer});`);
    assert.ok(start >= 0);
    assert.match(app.slice(start - 260,start), /guestCrossTabDerivedStale\) return/);
  }
  assert.match(app, /guestCrossTabShoppingStale \|\| guestCrossTabDerivedStale\) return/);
  assert.match(app, /const guestPantryReviewPending = !currentUser &&\s*\(guestCrossTabPantryStale \|\| guestCrossTabDerivedStale/);
  assert.match(app, /data-testid="guest-derived-cross-tab-warning"/);
  assert.match(app, /const requireAuthoritativeInventory = \(\) => \{\s*if \(!currentUser && guestCrossTabDerivedStale\)/);
});
test("real two-tab Chromium checks all 3 derived keys, stale pantry block and reload", () => {
  const start = browser.indexOf("async function runTwoTabDerivedChangeBlocksGuestFacts");
  const end = browser.indexOf("async function runTwoTabExternalStorageClearBlocksGuestFacts", start);
  assert.ok(start >= 0 && end > start);
  const scenario = browser.slice(start,end);
  for (const key of ["balkanbite_recipes","balkanbite_mealplan","balkanbite_progression"]) {
    assert.ok(scenario.includes(key));
  }
  assert.match(scenario,/guest-derived-cross-tab-warning/);
  assert.match(scenario,/source-change-warns-blocks-edit-reloads/);
  assert.ok(browser.includes("await runTwoTabDerivedChangeBlocksGuestFacts();"));
});
