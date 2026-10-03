import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const boundary = readFileSync(new URL("../src/utils/profileSyncBoundary.ts", import.meta.url), "utf8");

test("authenticated profile and health data are never persisted to localStorage", () => {
  assert.doesNotMatch(app, /localStorage\.setItem\([\s\S]{0,80}balkanbite_profile_user_/);
  assert.doesNotMatch(app, /localStorage\.getItem\([\s\S]{0,80}balkanbite_profile_user_/);
  assert.match(app, /localStorage\.removeItem\(\`balkanbite_profile_user_\$\{currentUser\.uid\}\`\)/);
  assert.doesNotMatch(app, /getUserProfileCacheKey/);
  assert.doesNotMatch(app, /parseUserProfileCache/);
  assert.doesNotMatch(boundary, /getUserProfileCacheKey/);
  assert.doesNotMatch(boundary, /parseUserProfileCache/);
});

test("signed-in startup uses neutral defaults until Firestore profile hydration", () => {
  const marker = app.indexOf("Never cache authenticated profile/health data in localStorage");
  assert.ok(marker >= 0);
  const block = app.slice(marker, marker + 500);
  assert.match(block, /createSignedInProfileDefaults\(currentUser\.displayName\)/);
});

test("guest profile cache remains local and explicit", () => {
  assert.match(app, /localStorage\.setItem\("balkanbite_profile", JSON\.stringify\(profile\)\)/);
  assert.match(app, /parseGuestProfileCache\(localStorage\.getItem\("balkanbite_profile"\)\)/);
});
