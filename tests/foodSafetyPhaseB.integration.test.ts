import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const serverSource = fs.readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);
const voiceSource = fs.readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);
const profileSource = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

function routeSlice(start: string, end: string): string {
  const from = serverSource.indexOf(start);
  const to = serverSource.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing route start: ${start}`);
  assert.notEqual(to, -1, `missing route end: ${end}`);
  return serverSource.slice(from, to);
}

test("AI recipe, meal-plan and shopping routes enforce the deterministic quarantine before model use", () => {
  for (const slice of [
    routeSlice('app.post("/api/ai/generate-recipes"', 'app.post("/api/ai/generate-weekly-plan"'),
    routeSlice('app.post("/api/ai/generate-weekly-plan"', 'app.post("/api/ai/suggest-shopping"'),
    routeSlice('app.post("/api/ai/suggest-shopping"', 'app.post("/api/ai/scan-image"'),
  ]) {
    const gate = slice.indexOf("foodRecommendationRequiresReview");
    const modelCall = slice.indexOf("generateWithOpenAI");
    assert.ok(gate >= 0);
    assert.ok(modelCall > gate);
    assert.match(slice, /FOOD_SAFETY_REVIEW_REQUIRED|foodSafetyBlockedPayload/);
  }
});

test("normal client requests carry the minimal quarantine marker and gate AI generation locally", () => {
  assert.match(appSource, /const foodSafetyQuarantine = getFoodSafetyQuarantine\(profile\)/);
  assert.match(appSource, /requireFoodRecommendationSafetyReview\(\)/);
  assert.ok((appSource.match(/foodSafety: foodSafetyQuarantine/g) ?? []).length >= 3);
});

test("voice recommendations are post-processed behind the quarantine while non-recommendation voice actions remain available", () => {
  assert.match(voiceSource, /foodSafety: FoodSafetyQuarantine/);
  assert.match(voiceSource, /foodSafety,/);
  const parseRoute = routeSlice(
    'app.post("/api/ai/parse-intent"',
    'app.post("/api/ai/reconcile-shopping"',
  );
  assert.match(parseRoute, /parsed\.actionType === "RECIPE_RECOMMENDATION"/);
  assert.match(parseRoute, /foodSafetyBlocked: true/);
});

test("profile exposes legacy food-restriction values and an explicit removal control", () => {
  assert.match(profileSource, /profile-legacy-food-safety-card/);
  assert.match(profileSource, /profile-clear-legacy-food-safety-btn/);
  assert.match(profileSource, /allergies: undefined/);
  assert.match(profileSource, /dietStyle: "all"/);
});
