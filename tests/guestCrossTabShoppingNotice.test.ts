import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const chromium = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");

test("guest shopping storage event latches an independent staleness block", () => {
  assert.match(app, /const \[guestCrossTabShoppingStale, setGuestCrossTabShoppingStale\] = useState\(false\)/);
  assert.match(app, /guestDerivedShoppingRecoveryProblem \|\| guestDerivedStorageWriteFailed \|\|\s*guestCrossTabShoppingStale/);
  assert.match(app, /event\.storageArea !== localStorage \|\| event\.key !== "balkanbite_shopping"/);
  assert.match(app, /event\.newValue !== JSON\.stringify\(shoppingList\)/);
  assert.match(app, /window\.addEventListener\("storage", onGuestShoppingStorageChanged\)/);
  assert.match(app, /window\.removeEventListener\("storage", onGuestShoppingStorageChanged\)/);
  assert.doesNotMatch(app, /setGuestCrossTabShoppingStale\(false\)/,
    "subsequent guest writes cannot silently clear an external-tab warning");
});
test("guest shopping hydration writer and shortage repair refuse to overwrite when stale", () => {
  const writerStart = app.indexOf('const existingRaw = localStorage.getItem("balkanbite_shopping")');
  assert.ok(writerStart > 0);
  const beforeWriter = app.slice(writerStart - 450, writerStart);
  assert.match(beforeWriter, /guestCrossTabShoppingStale\) return/);
  assert.match(app, /guestJournalRecoveryStatus !== "clear" \|\| guestPantryRecovery !== "none" \|\|\s*guestCrossTabShoppingStale\) return/);
});
test("real Chromium two-tab scenario requires warning before any attempted stale edit", () => {
  assert.match(chromium, /staleWarning\.waitFor\(\{ state: "visible", timeout: 12000 \}\)/);
  assert.match(chromium, /Another tab changed the shopping list/);
  assert.match(chromium, /proactive-storage-event-warning-before-edit/);
});
