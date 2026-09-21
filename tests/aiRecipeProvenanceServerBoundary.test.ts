import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

function endpointSection(startMarker: string, endMarker: string): string {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing endpoint start: ${startMarker}`);
  assert.ok(end > start, `missing endpoint end: ${endMarker}`);
  return serverSource.slice(start, end);
}

test("both recipe AI endpoints share the canonical estimate provenance boundary", () => {
  assert.match(
    serverSource,
    /applyAiRecipeEstimateProvenance.*aiRecipeProvenance\.js/,
  );

  const recipes = endpointSection(
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan',
  );
  const weekly = endpointSection(
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal',
  );

  assert.match(recipes, /applyAiRecipeEstimateProvenance\(rec\)/);
  assert.match(weekly, /applyAiRecipeEstimateProvenance\(meal\)/);
});

test("weekly plan normalizes breakfast lunch and dinner before response", () => {
  const weekly = endpointSection(
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal',
  );

  assert.match(weekly, /breakfast:\s*normalizePlannedMeal\(day\.breakfast\)/);
  assert.match(weekly, /lunch:\s*normalizePlannedMeal\(day\.lunch\)/);
  assert.match(weekly, /dinner:\s*normalizePlannedMeal\(day\.dinner\)/);
  assert.match(
    weekly,
    /imageUrl:\s*resolveRecipeImageUrl\(withProvenance\)/,
  );
});

test("server no longer maintains a separate ad-hoc recipe provenance assignment", () => {
  const recipes = endpointSection(
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan',
  );

  assert.doesNotMatch(
    recipes,
    /healthScore:\s*undefined[\s\S]*nutritionDataStatus:\s*"estimated"[\s\S]*costDataStatus:\s*"estimated"/,
  );
});
