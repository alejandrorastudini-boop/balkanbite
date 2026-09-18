import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
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
