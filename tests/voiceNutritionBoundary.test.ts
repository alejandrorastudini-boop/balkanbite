import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8"
);
const verifiedMealLogSource = readFileSync(
  new URL("../src/utils/verifiedMealLog.ts", import.meta.url),
  "utf8"
);

test("voice AI failure cannot fabricate pantry additions or meal nutrition", () => {
  assert.doesNotMatch(serverSource, /function fallbackParseIntent\(/);
  assert.doesNotMatch(serverSource, /calories:\s*450/);
  assert.match(
    serverSource,
    /Voice interpretation is temporarily unavailable[\s\S]*items:\s*\[\][\s\S]*mealLog:\s*null/
  );
  assert.match(
    serverSource,
    /Voice interpretation failed[\s\S]*items:\s*\[\][\s\S]*mealLog:\s*null/
  );
});

test("free-form voice nutrition stays unsaved without verified provenance", () => {
  assert.match(
    serverSource,
    /do not calculate or invent calories, protein, carbs, fat/
  );
  assert.match(
    serverSource,
    /if \(parsed\.actionType === "MEAL_LOG"\) \{\s*parsed\.mealLog = null;/
  );
  assert.match(
    voiceSource,
    /data\.mealLog\?\.nutritionVerified === true[\s\S]*onLogMeal\(data\.mealLog\)/
  );
  assert.match(
    voiceSource,
    /I did not save nutrition values because there is not yet a verified source/
  );
});


test("App meal logging never fills missing verified nutrition with zero", () => {
  const start = appSource.indexOf("const handleLogMeal");
  const end = appSource.indexOf("const handleGenerateAiShopping", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);

  assert.match(handler, /buildVerifiedMealLog\(/);
  assert.match(handler, /if \(!newLog\)/);
  assert.doesNotMatch(handler, /Number\.isFinite\([^)]*\)\s*\?[^:]+:\s*0/);
  assert.doesNotMatch(handler, /nutritionDataStatus:\s*"unknown"/);
});

test("verified meal-log boundary requires complete non-negative nutrition", () => {
  assert.match(verifiedMealLogSource, /candidate\.nutritionVerified !== true/);
  assert.match(verifiedMealLogSource, /nutritionDataStatus:\s*"verified"/);
  for (const field of ["calories", "proteinG", "carbsG", "fatG"]) {
    assert.match(
      verifiedMealLogSource,
      new RegExp(`isFiniteNonNegativeNumber\\(candidate\\.${field}\\)`),
    );
  }
});


test("App sanitizes historical meal-log caches instead of type-casting stored arrays", () => {
  assert.match(appSource, /parseMealLogCache\(localStorage\.getItem\("balkanbite_meallogs"\)\)/);
  assert.match(
    appSource,
    /parseMealLogCache\([\s\S]*getUserLocalWorkspaceKey\([\s\S]*"balkanbite_meallogs"/,
  );
  assert.doesNotMatch(appSource, /parseArrayCache<MealLog>/);
  assert.match(verifiedMealLogSource, /sanitizeStoredMealLog/);
  assert.match(verifiedMealLogSource, /nutritionDataStatus:\s*"unknown"/);
});
