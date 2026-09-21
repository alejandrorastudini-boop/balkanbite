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

test("both recipe AI endpoints compose provenance with the structural recipe gate", () => {
  assert.match(
    serverSource,
    /applyAiRecipeEstimateProvenance.*aiRecipeProvenance\.js/,
  );
  assert.match(
    serverSource,
    /validateAiRecipeStructure.*aiRecipeValidation\.js/,
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
  assert.match(
    recipes,
    /validateAiRecipeStructure\(\s*withProvenance,\s*`ai-rec-/,
  );
  assert.match(weekly, /applyAiRecipeEstimateProvenance\(meal\)/);
  assert.match(
    weekly,
    /validateAiRecipeStructure\(withProvenance, fallbackId\)/,
  );
});

test("weekly plan requires exact requested dates and three valid meals per day", () => {
  const weekly = endpointSection(
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal',
  );

  assert.match(weekly, /record\.date !== expectedDate/);
  assert.match(
    weekly,
    /normalizePlannedMeal\(\s*record\.breakfast,[\s\S]*ai-plan-\$\{expectedDate\}-breakfast/,
  );
  assert.match(
    weekly,
    /normalizePlannedMeal\(\s*record\.lunch,[\s\S]*ai-plan-\$\{expectedDate\}-lunch/,
  );
  assert.match(
    weekly,
    /normalizePlannedMeal\(\s*record\.dinner,[\s\S]*ai-plan-\$\{expectedDate\}-dinner/,
  );
  assert.match(weekly, /if \(!breakfast \|\| !lunch \|\| !dinner\) return \[\]/);
  assert.match(
    weekly,
    /rawPlan\.length !== dates\.length \|\| mealPlan\.length !== dates\.length/,
  );
  assert.match(
    weekly,
    /status\(502\)[\s\S]*incomplete or invalid plan[\s\S]*mealPlan: \[\]/,
  );
});

test("recipe endpoint never returns a structurally invalid object as usable", () => {
  const recipes = endpointSection(
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan',
  );

  assert.match(recipes, /if \(!validated\) return \[\]/);
  assert.match(
    recipes,
    /enrichedRecipes\.length === 0[\s\S]*status\(502\)[\s\S]*recipes: \[\]/,
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
