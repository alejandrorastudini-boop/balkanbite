import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const routes = [
  "/api/ai/generate-recipes",
  "/api/ai/generate-weekly-plan",
  "/api/ai/suggest-shopping",
];

test("recommendation endpoints reject unwired confirmed restrictions before AI generation", () => {
  assert.match(server, /hasOwnProperty\.call\(req\.body, "foodRestrictionIntent"\)/);
  assert.match(server, /FOOD_RESTRICTION_SCREENING_NOT_AVAILABLE/);
  assert.match(server, /res\.status\(409\)/);

  for (const route of routes) {
    const start = server.indexOf(`app.post("${route}"`);
    assert.notEqual(start, -1, route);
    const end = server.indexOf("\n});", start);
    const body = server.slice(start, end);
    const quarantine = body.indexOf("foodRecommendationRequiresReview(profile, foodSafety)");
    const reject = body.indexOf("rejectUnwiredFoodRestrictionIntent(req, res)");
    const ai = body.indexOf("generateWithOpenAI(");
    assert.ok(quarantine >= 0 && reject > quarantine && ai > reject, route);
  }
});

test("legacy quarantine remains authoritative and no new collection/persistence is added", () => {
  const helperStart = server.indexOf("function rejectUnwiredFoodRestrictionIntent(");
  const helperEnd = server.indexOf("\nfunction foodSafetyBlockedPayload(", helperStart);
  const helper = server.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.doesNotMatch(helper, /console\.|setDoc|addDoc|localStorage|JSON\.stringify\(req\.body/);
  assert.match(helper, /FOOD_RESTRICTION_SCREENING_NOT_AVAILABLE/);
});
