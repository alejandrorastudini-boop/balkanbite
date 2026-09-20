import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

function endpointSection(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing endpoint start: ${startMarker}`);
  assert.ok(end > start, `missing endpoint end: ${endMarker}`);
  return source.slice(start, end);
}

test("generated recipe endpoint applies the shared planning-provenance boundary", () => {
  const recipes = endpointSection(
    'app.post("/api/ai/generate-recipes"',
    '// Endpoint: AI Smart 7-Day Weekly Meal Plan',
  );

  assert.match(
    recipes,
    /markAiGeneratedRecipePlanningEstimates\(rec\)/,
  );
  assert.doesNotMatch(
    recipes,
    /nutritionDataStatus:\s*"verified"|costDataStatus:\s*"verified"/,
  );
});

test("weekly AI plan applies planning provenance to every model-produced meal", () => {
  const weekly = endpointSection(
    'app.post("/api/ai/generate-weekly-plan"',
    '// Endpoint: AI Smart Weekly Shopping List Proposal',
  );

  assert.match(
    weekly,
    /const withWeeklyMealProvenance = \(meal: any\)/,
  );
  assert.match(
    weekly,
    /markAiGeneratedRecipePlanningEstimates\(meal\)/,
  );
  assert.match(
    weekly,
    /breakfast:\s*withWeeklyMealProvenance\(day\.breakfast\)/,
  );
  assert.match(
    weekly,
    /lunch:\s*withWeeklyMealProvenance\(day\.lunch\)/,
  );
  assert.match(
    weekly,
    /dinner:\s*withWeeklyMealProvenance\(day\.dinner\)/,
  );
});
