import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const qa = readFileSync(new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");

test("clear() is a null-key cross-tab event and invalidates both guest sources", () => {
  for (const [listener, latch] of [
    ["onGuestShoppingStorageChanged", "setGuestCrossTabShoppingStale"],
    ["onGuestPantryStorageChanged", "setGuestCrossTabPantryStale"],
  ]) {
    const start = app.indexOf(`const ${listener} =`);
    const end = app.indexOf('window.addEventListener("storage",', start);
    assert.ok(start > 0 && end > start, `${listener} must be scoped to guest listener`);
    const body = app.slice(start, end);
    assert.match(body, /event\.storageArea === localStorage && event\.key === null/);
    assert.match(body, new RegExp(`${latch}\\(true\\)`));
    assert.ok(body.indexOf("event.key === null") <
      body.indexOf('event.key !=='), "global clear must be handled before key filter");
  }
  assert.doesNotMatch(app, /setGuestCrossTabShoppingStale\(false\)/);
  assert.doesNotMatch(app, /setGuestCrossTabPantryStale\(false\)/);
});
test("real two-tab Chromium global clear cannot resurrect stale stock or shopping", () => {
  const start = qa.indexOf("async function runTwoTabExternalStorageClearBlocksGuestFacts");
  const end = qa.indexOf("async function runTwoTabStaleInventory", start);
  assert.ok(start >= 0 && end > start);
  const testBody = qa.slice(start, end);
  assert.match(testBody, /localStorage\.clear\(\)/);
  assert.match(testBody, /guest-pantry-cross-tab-warning/);
  assert.match(testBody, /guest-shopping-consistency-warning/);
  assert.match(testBody, /getByRole\("button", \{ name: "Increase quantity" \}\)\.click\(\)/);
  assert.match(testBody, /guest-cross-tab-global-storage-clear-warns-and-blocks-resurrection/);
  assert.match(testBody, /stale guest actions may not resurrect keys cleared in another tab/);
});
