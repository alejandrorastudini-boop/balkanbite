import assert from "node:assert/strict";
import test from "node:test";
import {
  createSignedInProfileDefaults,
  getUserProfileCacheKey,
  parseGuestProfileCache,
  parseUserProfileCache,
  sanitizeRemoteUserProfile,
} from "../src/utils/profileSyncBoundary";

test("new signed-in profiles do not inherit guest completion or preferences", () => {
  const profile = createSignedInProfileDefaults("  Alex  ");

  assert.equal(profile.name, "Alex");
  assert.equal(profile.onboardingCompleted, false);
  assert.equal(profile.isProSubscriber, false);
  assert.deepEqual(profile.disliked, []);
  assert.equal(profile.monthlyBudgetEUR, undefined);
  assert.equal(profile.householdSize, undefined);
});

test("remote profiles are rebuilt from allowed fields instead of merged with another session", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "User B",
    language: "bg",
    currency: "EUR",
    cookingSpeed: "moderate",
    healthGoal: "balanced",
    dietStyle: "vegetarian",
    disliked: [" liver ", "liver"],
    budgetTier: "strict_budget",
    onboardingCompleted: true,
    isProSubscriber: true,
    userId: "must-not-enter-app-profile",
    createdAt: { fake: true },
    arbitrarySecret: "ignore-me",
  });

  assert.deepEqual(profile.disliked, ["liver"]);
  assert.equal(profile.name, "User B");
  assert.equal(profile.language, "bg");
  assert.equal(profile.onboardingCompleted, true);
  assert.equal(profile.isProSubscriber, true);
  assert.equal("userId" in profile, false);
  assert.equal("createdAt" in profile, false);
  assert.equal("arbitrarySecret" in profile, false);
});

test("invalid or missing remote values resolve to neutral signed-in defaults", () => {
  const profile = sanitizeRemoteUserProfile({
    language: "xx",
    currency: "BGN",
    monthlyBudgetEUR: -100,
    householdSize: 0,
    onboardingCompleted: "yes",
  });

  assert.equal(profile.onboardingCompleted, false);
  assert.equal(profile.monthlyBudgetEUR, undefined);
  assert.equal(profile.householdSize, undefined);
  assert.equal(profile.isProSubscriber, false);
});

test("profile caches are user-scoped and malformed caches stay unavailable", () => {
  assert.equal(
    getUserProfileCacheKey("user-1"),
    "balkanbite_profile_user_user-1",
  );
  assert.notEqual(
    getUserProfileCacheKey("user-1"),
    getUserProfileCacheKey("user-2"),
  );
  assert.equal(parseUserProfileCache("not-json", "A"), null);
  assert.equal(parseUserProfileCache(null, "A"), null);
});

test("guest cache parsing does not accept arbitrary non-object payloads", () => {
  assert.equal(parseGuestProfileCache("[]"), null);
  assert.equal(parseGuestProfileCache("null"), null);
});
