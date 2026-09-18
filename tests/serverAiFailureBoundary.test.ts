import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

function endpointSection(startMarker: string, endMarker: string) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing endpoint start: ${startMarker}`);
  assert.notEqual(end, -1, `missing endpoint end: ${endMarker}`);
  return serverSource.slice(start, end);
}

test("visual scanner failures are explicit no-result states", () => {
  const scan = endpointSection(
    'app.post("/api/ai/scan-image"',
    '// Endpoint: Barcode Lookup'
  );

  assert.match(scan, /success:\s*true/);
  assert.match(scan, /status\(503\)\.json\(\{[\s\S]*success:\s*false[\s\S]*items:\s*\[\]/);
  assert.doesNotMatch(scan, /mock_fallback|resilient_fallback/);
  assert.doesNotMatch(scan, /Detected Grocery|Alimento detectado|Открита храна/);
});

test("shopping AI failure has no fabricated basket fallback", () => {
  const shopping = endpointSection(
    'app.post("/api/ai/suggest-shopping"',
    '// Endpoint: AI Visual Scanner'
  );

  assert.match(
    shopping,
    /status\(503\)\.json\(\{[\s\S]*Shopping suggestions are temporarily unavailable[\s\S]*items:\s*\[\]/
  );
  assert.doesNotMatch(shopping, /resilient_fallback/);
  assert.doesNotMatch(shopping, /This core basket costs under/);
  assert.doesNotMatch(shopping, /Include accurate prices/);
  assert.match(shopping, /unverified planning estimate only/);
});


test("recipe and weekly-plan AI failures cannot become fallback content", () => {
  const recipes = endpointSection(
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan'
  );
  const weekly = endpointSection(
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal'
  );

  assert.match(recipes, /Recipe generation is temporarily unavailable[\s\S]*recipes:\s*\[\]/);
  assert.match(recipes, /Recipe generation failed[\s\S]*recipes:\s*\[\]/);
  assert.doesNotMatch(recipes, /curated_fallback|fallback_error/);
  assert.doesNotMatch(recipes, /rawList[\s\S]*FALLBACK_RECIPES/);

  assert.match(weekly, /Weekly meal-plan generation failed[\s\S]*mealPlan:\s*\[\]/);
  assert.doesNotMatch(weekly, /fallbackPlan|Healthy Breakfast|Desayuno saludable/);
});
