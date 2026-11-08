import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SAMPLE_RECIPES } from "../src/data/initialData";
import {
  guestRecipeCacheIsComplete,
  guestMealPlanCacheIsComplete,
} from "../src/utils/guestDerivedShoppingRecovery";

const sample = SAMPLE_RECIPES[0];

test("unsaved and valid empty guest derived caches permit first-time persistence", () => {
  for (const verify of [guestRecipeCacheIsComplete, guestMealPlanCacheIsComplete]) {
    assert.equal(verify(null), true);
    assert.equal(verify("[]"), true);
  }
});

test("valid recipes and meal-plan days are not rejected", () => {
  assert.ok(sample);
  assert.equal(guestRecipeCacheIsComplete(JSON.stringify([sample])), true);
  assert.equal(guestMealPlanCacheIsComplete(
    JSON.stringify([{ date: "2026-10-30", dinner: sample }]),
  ), true);
});

test("malformed top-level and partially filtered historical recipe rows block rewrite", () => {
  assert.ok(sample);
  for (const raw of [
    "{invalid source",
    JSON.stringify({ id: "old-recipe" }),
    JSON.stringify([{ id: "legacy-only-id" }]),
    JSON.stringify([sample, { id: "legacy-only-id" }]),
  ]) {
    assert.equal(guestRecipeCacheIsComplete(raw), false, raw);
  }
});

test("invalid dates, unknown meals and partial plan rows block destructive rewrite", () => {
  assert.ok(sample);
  for (const raw of [
    "{invalid source",
    JSON.stringify({ date: "2026-10-30" }),
    JSON.stringify([{ date: "2026-02-30", lunch: sample }]),
    JSON.stringify([{ date: "2026-10-30", lunch: { id: "legacy" } }]),
    JSON.stringify([
      { date: "2026-10-30", dinner: sample },
      { date: "not-a-date", lunch: sample },
    ]),
  ]) {
    assert.equal(guestMealPlanCacheIsComplete(raw), false, raw);
  }
});

test("guest hydration effects retain unknown original bytes and warn instead of overwriting", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /if \(!guestRecipeCacheIsComplete\(originalRaw\)\) \{[\s\S]*?setGuestDerivedStorageWriteFailed\(true\);[\s\S]*?return;/);
  assert.match(app, /if \(!guestMealPlanCacheIsComplete\(originalRaw\)\) \{[\s\S]*?setGuestDerivedStorageWriteFailed\(true\);[\s\S]*?return;/);
  const runtime = readFileSync(
    new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");
  assert.match(runtime, /runMalformedGuestDerivedCachePreservation/);
  assert.match(runtime, /malformed-guest-balkanbite_recipes-source-retained-on-reload/);
  assert.match(runtime, /malformed-guest-balkanbite_mealplan-source-retained-on-reload/);
});
