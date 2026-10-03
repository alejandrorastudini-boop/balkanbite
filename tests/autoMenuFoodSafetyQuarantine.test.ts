import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const voice = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");

test("unresolved food-safety quarantine cannot automatically replace planned meals", () => {
  const start = app.indexOf("const adaptMealPlanSafelyToPantry");
  const end = app.indexOf("const requireFoodRecommendationSafetyReview", start);
  assert.ok(start >= 0 && end > start);
  const helper = app.slice(start, end);
  assert.match(helper, /currentUser && !profileHydrated/);
  assert.match(helper, /foodSafetyQuarantine\.status !== "clear"/);
  assert.match(helper, /return syncMealPlanWithPantry\(existingPlan, updatedPantry\)/);
  assert.match(helper, /return adaptMealPlanToPantry/);
});

test("all App pantry-driven adaptation routes pass through the quarantine-aware helper", () => {
  const calls = app.match(/adaptMealPlanSafelyToPantry\(/g) ?? [];
  assert.ok(calls.length >= 5);
  const directCalls = app.match(/adaptMealPlanToPantry\(/g) ?? [];
  assert.equal(directCalls.length, 1, "only the safety helper may call raw adaptation");
});

test("explicit adapt-menu action surfaces unresolved safety review instead of silently reshuffling meals", () => {
  const start = app.indexOf("const handleAdaptMenuToPantry");
  const end = app.indexOf("const handleClearPantry", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.match(handler, /requireFoodRecommendationSafetyReview\(\)/);
});

test("signed-in food generation waits for authoritative profile hydration", () => {
  const start = app.indexOf("const requireFoodRecommendationSafetyReview");
  const end = app.indexOf("const [showLanding", start);
  assert.ok(start >= 0 && end > start);
  const gate = app.slice(start, end);
  assert.match(gate, /if \(currentUser && !profileHydrated\)/);
  assert.match(gate, /return false/);
});

test("voice food AI cannot run against neutral signed-in startup defaults", () => {
  assert.match(app, /profileAuthorityReady=\{!currentUser \|\| profileHydrated\}/);
  assert.match(voice, /if \(!profileAuthorityReady\)/);
  const gate = voice.indexOf("if (!profileAuthorityReady)");
  const fetchIntent = voice.indexOf('fetch("/api/ai/parse-intent"', gate);
  assert.ok(gate >= 0 && fetchIntent > gate);
  assert.match(voice.slice(gate, fetchIntent), /return;/);
});
