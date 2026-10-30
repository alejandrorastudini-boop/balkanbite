import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const browser = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");
test("guest cross-tab pantry listener invalidates only external pantry writes", () => {
  assert.match(app, /const \[guestCrossTabPantryStale, setGuestCrossTabPantryStale\] = useState\(false\)/);
  assert.match(app, /event\.storageArea !== localStorage \|\| event\.key !== GUEST_PANTRY_KEY/);
  assert.match(app, /if \(event\.newValue !== event\.oldValue\) setGuestCrossTabPantryStale\(true\)/);
  assert.match(app, /window\.addEventListener\("storage", onGuestPantryStorageChanged\)/);
  assert.match(app, /window\.removeEventListener\("storage", onGuestPantryStorageChanged\)/);
  assert.doesNotMatch(app, /setGuestCrossTabPantryStale\(false\)/);
});
test("pantry-derived authority, mutations and warnings are fail-closed", () => {
  assert.match(app, /const guestPantryReviewPending = !currentUser &&\s*\(guestCrossTabPantryStale/);
  assert.match(app, /const requireAuthoritativeInventory = \(\) => \{\s*if \(!currentUser && guestCrossTabPantryStale\)/);
  assert.match(app, /const commitGuestPantry = \([\s\S]*?if \(guestCrossTabPantryStale\)/);
  assert.match(app, /data-testid="guest-pantry-cross-tab-warning"/);
  assert.match(app, /guestCrossTabPantryStale \|\| guestShoppingConsistencyProblem\) return null/);
  assert.match(app, /guestCrossTabPantryStale \|\| guestShoppingReviewRequired/);
});
test("real two-tab Chromium checks warning before the stale edit and reload recovery", () => {
  const start=browser.indexOf("async function runTwoTabStaleInventory");
  const end=browser.indexOf("async function runTwoTabVoicePurchaseRecovery",start);
  assert.ok(start>=0&&end>start);
  const scenario=browser.slice(start,end);
  assert.match(scenario, /guest-pantry-cross-tab-warning/);
  assert.match(scenario, /externalWarning\.waitFor\(\{ state: "visible", timeout: 12000 \}\)/);
  assert.ok(scenario.indexOf("await externalWarning.waitFor") < scenario.indexOf("await increment(stale).click()"));
  assert.match(scenario, /stale-second-tab-proactive-pantry-warning-and-no-overwrite/);
});
