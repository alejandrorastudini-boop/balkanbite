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

function section(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("client minimizes profile data before all generic culinary AI requests", () => {
  for (const endpoint of [
    "/api/ai/generate-recipes",
    "/api/ai/generate-weekly-plan",
    "/api/ai/suggest-shopping",
  ]) {
    const start = appSource.indexOf(`fetch("${endpoint}"`);
    assert.notEqual(start, -1, `missing client endpoint: ${endpoint}`);
    const end = appSource.indexOf("const data = await res.json()", start);
    assert.notEqual(end, -1, `missing response boundary: ${endpoint}`);
    const request = appSource.slice(start, end);

    assert.match(
      request,
      /profile:\s*buildAiCulinaryProfileContext\(profile\)/,
    );
    assert.doesNotMatch(request, /\n\s*profile,\n/);
  }
});

test("recipe AI does not receive healthGoal or invented household/budget defaults", () => {
  const recipes = section(
    serverSource,
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan',
  );

  assert.match(recipes, /buildAiCulinaryProfileContext\(profile\)/);
  assert.match(recipes, /User culinary preferences \(non-clinical\)/);
  assert.doesNotMatch(recipes, /profile\.healthGoal/);
  assert.doesNotMatch(recipes, /Health Goal:/);
  assert.doesNotMatch(recipes, /balanced & gut-health/);
  assert.doesNotMatch(recipes, /profile\.servings \|\| 2/);
  assert.doesNotMatch(recipes, /budgetConstraint/);
});

test("weekly plan is culinary, not a free-form nutritionist/clinical role", () => {
  const weekly = section(
    serverSource,
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal',
  );

  assert.match(weekly, /buildAiCulinaryProfileContext\(profile\)/);
  assert.match(weekly, /culinary meal-planning assistant/);
  assert.doesNotMatch(weekly, /expert Balkan and Mediterranean nutritionist/);
  assert.doesNotMatch(weekly, /User Profile & Health Goal/);
  assert.doesNotMatch(weekly, /JSON\.stringify\(profile\)/);
  assert.match(weekly, /Do not infer disease, nutrient deficiency/);
});

test("shopping AI complements pantry without inferring nutritional deficiencies", () => {
  const shopping = section(
    serverSource,
    'app.post("/api/ai/suggest-shopping"',
    '// Endpoint: AI Visual Scanner',
  );

  assert.match(shopping, /buildAiCulinaryProfileContext\(profile\)/);
  assert.doesNotMatch(shopping, /JSON\.stringify\(profile\)/);
  assert.doesNotMatch(shopping, /Identify possible nutritional gaps/);
  assert.match(shopping, /Do not infer nutrient deficiencies, disease, health status/);
});
