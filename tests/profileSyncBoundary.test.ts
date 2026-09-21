import assert from "node:assert/strict";
import test from "node:test";
import { removeHealthProfileField } from "../src/utils/healthProfile";
import {
  createSignedInProfileDefaults,
  getUserProfileCacheKey,
  parseGuestProfileCache,
  parseUserProfileCache,
  sanitizeRemoteUserProfile,
  serializeUserProfileForFirestore,
} from "../src/utils/profileSyncBoundary";

test("new signed-in profiles do not inherit guest completion or preferences", () => {
  const profile = createSignedInProfileDefaults("  Alex  ");

  assert.equal(profile.name, "Alex");
  assert.equal(profile.onboardingCompleted, false);
  assert.equal("isProSubscriber" in profile, false);
  assert.deepEqual(profile.disliked, []);
  assert.equal(profile.monthlyBudgetEUR, undefined);
  assert.equal(profile.householdSize, undefined);
  assert.equal(profile.cookingSpeed, undefined);
  assert.equal(profile.dietStyle, undefined);
  assert.equal(profile.healthGoal, undefined);
  assert.equal(profile.budgetTier, undefined);
  assert.equal(profile.healthProfile, undefined);
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
  assert.equal(profile.healthGoal, "balanced");
  assert.equal(profile.budgetTier, "strict_budget");
  assert.equal(profile.onboardingCompleted, true);
  assert.equal("isProSubscriber" in profile, false);
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
  assert.equal(profile.cookingSpeed, undefined);
  assert.equal(profile.dietStyle, undefined);
  assert.equal(profile.healthGoal, undefined);
  assert.equal(profile.budgetTier, undefined);
  assert.equal("isProSubscriber" in profile, false);
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


test("Firestore profile serialization preserves unknowns as null, never undefined", () => {
  const profile = createSignedInProfileDefaults("Alex");
  const serialized = serializeUserProfileForFirestore(profile);

  assert.equal(serialized.allergies, null);
  assert.equal(serialized.appliances, null);
  assert.equal(serialized.householdSize, null);
  assert.equal(serialized.cookingLevel, null);
  assert.equal(serialized.monthlyBudgetEUR, null);
  assert.equal(serialized.cookingSpeed, null);
  assert.equal(serialized.dietStyle, null);
  assert.equal(serialized.healthGoal, null);
  assert.equal(serialized.budgetTier, null);
  assert.equal(serialized.healthProfile, null);
  assert.equal(serialized.isProSubscriber, null);
  assert.equal(serialized.heightCm, null);
  assert.equal(serialized.weightKg, null);
  assert.equal(
    Object.values(serialized).some((value) => value === undefined),
    false,
  );
});

test("Firestore profile serialization clones optional arrays and round-trips null as unknown", () => {
  const profile = {
    ...createSignedInProfileDefaults("Alex"),
    allergies: ["milk"],
    appliances: ["oven"],
    householdSize: 2,
    monthlyBudgetEUR: 300,
  };
  const serialized = serializeUserProfileForFirestore(profile);

  assert.deepEqual(serialized.allergies, ["milk"]);
  assert.deepEqual(serialized.appliances, ["oven"]);
  assert.equal(serialized.householdSize, 2);
  assert.equal(serialized.monthlyBudgetEUR, 300);

  const sanitized = sanitizeRemoteUserProfile({
    ...serialized,
    allergies: null,
    appliances: null,
    householdSize: null,
    monthlyBudgetEUR: null,
  });
  assert.equal(sanitized.allergies, undefined);
  assert.equal(sanitized.appliances, undefined);
  assert.equal(sanitized.householdSize, undefined);
  assert.equal(sanitized.monthlyBudgetEUR, undefined);
});


test("Firestore serialization never emits undefined when required runtime fields are malformed", () => {
  const malformed = {
    ...createSignedInProfileDefaults(),
    name: undefined,
    language: undefined,
    currency: undefined,
    cookingSpeed: undefined,
    healthGoal: undefined,
    dietStyle: undefined,
    disliked: undefined,
    budgetTier: undefined,
    onboardingCompleted: undefined,
  } as unknown as Parameters<typeof serializeUserProfileForFirestore>[0];

  const serialized = serializeUserProfileForFirestore(malformed);
  assert.equal(
    Object.values(serialized).some((value) => value === undefined),
    false,
  );
  assert.equal(typeof serialized.name, "string");
});


test("optional body metrics persist through HealthProfile and legacy fields are cleared", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      ageYears: {
        status: "known",
        value: 34,
        source: "self_reported",
        recordedAt: "2026-09-20T07:00:00.000Z",
      },
      heightCm: {
        status: "known",
        value: 182.5,
        source: "measured",
        recordedAt: "2026-09-20T07:00:00.000Z",
      },
      weightKg: {
        status: "known",
        value: 79.4,
        source: "self_reported",
        recordedAt: "2026-09-20T07:00:00.000Z",
      },
    },
  });
  const serialized = serializeUserProfileForFirestore(profile);

  assert.deepEqual(serialized.healthProfile, {
    version: 1,
    ageYears: {
      status: "known",
      value: 34,
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    heightCm: {
      status: "known",
      value: 182.5,
      source: "measured",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    weightKg: {
      status: "known",
      value: 79.4,
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    physiologicalSex: null,
    activityCategory: null,
    pregnancyLactationStatus: null,
  });
  assert.equal(serialized.heightCm, null);
  assert.equal(serialized.weightKg, null);
});

test("legacy remote body metrics migrate into HealthProfile on read", () => {
  const sanitized = sanitizeRemoteUserProfile({
    name: "Legacy",
    heightCm: 175,
    weightKg: 70,
  });

  assert.equal(sanitized.healthProfile?.heightCm?.value, 175);
  assert.equal(sanitized.healthProfile?.heightCm?.source, "self_reported");
  assert.equal(sanitized.healthProfile?.weightKg?.value, 70);
  assert.equal(sanitized.healthProfile?.weightKg?.source, "self_reported");
});


test("optional energy inputs round-trip without defaults or inference", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      physiologicalSex: {
        status: "known",
        value: "male",
        source: "self_reported",
        recordedAt: "2026-09-20T09:00:00.000Z",
      },
      activityCategory: {
        status: "known",
        value: "active",
        source: "self_reported",
        recordedAt: "2026-09-20T09:00:00.000Z",
      },
      pregnancyLactationStatus: {
        status: "not_applicable",
        source: "self_reported",
      },
    },
  });

  const serialized = serializeUserProfileForFirestore(profile);
  const healthProfile = serialized.healthProfile as Record<string, unknown>;

  assert.deepEqual(healthProfile.physiologicalSex, {
    status: "known",
    value: "male",
    source: "self_reported",
    recordedAt: "2026-09-20T09:00:00.000Z",
  });
  assert.deepEqual(healthProfile.activityCategory, {
    status: "known",
    value: "active",
    source: "self_reported",
    recordedAt: "2026-09-20T09:00:00.000Z",
  });
  assert.deepEqual(healthProfile.pregnancyLactationStatus, {
    status: "not_applicable",
    value: null,
    source: "self_reported",
    recordedAt: null,
  });
});


test("clearing HealthProfile serializes an explicit cloud null", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      heightCm: {
        status: "known",
        value: 180,
        source: "self_reported",
      },
      weightKg: {
        status: "known",
        value: 80,
        source: "self_reported",
      },
    },
  });

  const cleared = {
    ...profile,
    healthProfile: undefined,
  };

  const serialized = serializeUserProfileForFirestore(cleared);
  assert.equal(serialized.healthProfile, null);
});


test("legacy food-restriction values survive read until the user explicitly clears them", () => {
  const legacy = sanitizeRemoteUserProfile({
    name: "Legacy",
    dietStyle: "gluten_free",
    allergies: ["Gluten", "Lactosa"],
  });

  assert.equal(legacy.dietStyle, "gluten_free");
  assert.deepEqual(legacy.allergies, ["Gluten", "Lactosa"]);

  const cleared = serializeUserProfileForFirestore({
    ...legacy,
    dietStyle: "all",
    allergies: undefined,
  });

  assert.equal(cleared.dietStyle, "all");
  assert.equal(cleared.allergies, null);
});


test("removing one HealthProfile field clears it in cloud serialization without touching siblings", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      ageYears: {
        status: "known",
        value: 35,
        source: "self_reported",
      },
      heightCm: {
        status: "known",
        value: 175,
        source: "measured",
      },
    },
  });

  const healthProfile = removeHealthProfileField(
    profile.healthProfile,
    "ageYears",
  );
  const serialized = serializeUserProfileForFirestore({
    ...profile,
    healthProfile,
  });
  const cloudHealth = serialized.healthProfile as Record<string, unknown>;

  assert.equal(cloudHealth.ageYears, null);
  assert.deepEqual(cloudHealth.heightCm, {
    status: "known",
    value: 175,
    source: "measured",
    recordedAt: null,
  });
});

test("removing the final HealthProfile field serializes the whole cloud profile as null", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      weightKg: {
        status: "unknown",
        source: "self_reported",
      },
    },
  });

  const healthProfile = removeHealthProfileField(
    profile.healthProfile,
    "weightKg",
  );
  const serialized = serializeUserProfileForFirestore({
    ...profile,
    healthProfile,
  });

  assert.equal(healthProfile, undefined);
  assert.equal(serialized.healthProfile, null);
});


test("historical explicit healthGoal and budgetTier round-trip without creating replacements", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Legacy preferences",
    healthGoal: "heart",
    budgetTier: "strict_budget",
  });

  assert.equal(profile.healthGoal, "heart");
  assert.equal(profile.budgetTier, "strict_budget");

  const serialized = serializeUserProfileForFirestore(profile);
  assert.equal(serialized.healthGoal, "heart");
  assert.equal(serialized.budgetTier, "strict_budget");
});

test("invalid historical preference values remain absent instead of becoming balanced", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Invalid preferences",
    healthGoal: "whatever",
    budgetTier: "cheap",
  });

  assert.equal(profile.healthGoal, undefined);
  assert.equal(profile.budgetTier, undefined);

  const serialized = serializeUserProfileForFirestore(profile);
  assert.equal(serialized.healthGoal, null);
  assert.equal(serialized.budgetTier, null);
});


test("legacy Pro subscriber booleans are ignored and cleared from cloud serialization", () => {
  for (const legacyValue of [true, false]) {
    const profile = sanitizeRemoteUserProfile({
      name: "Legacy commercial state",
      isProSubscriber: legacyValue,
    });

    assert.equal("isProSubscriber" in profile, false);

    const serialized = serializeUserProfileForFirestore(profile);
    assert.equal(serialized.isProSubscriber, null);
  }
});


test("historical explicit culinary choices round-trip without default replacement", () => {
  const ordinary = sanitizeRemoteUserProfile({
    name: "Explicit culinary",
    cookingSpeed: "moderate",
    dietStyle: "vegetarian",
  });

  assert.equal(ordinary.cookingSpeed, "moderate");
  assert.equal(ordinary.dietStyle, "vegetarian");

  const ordinarySerialized = serializeUserProfileForFirestore(ordinary);
  assert.equal(ordinarySerialized.cookingSpeed, "moderate");
  assert.equal(ordinarySerialized.dietStyle, "vegetarian");

  const legacy = sanitizeRemoteUserProfile({
    name: "Legacy restriction",
    cookingSpeed: "elaborate",
    dietStyle: "gluten_free",
  });

  assert.equal(legacy.cookingSpeed, "elaborate");
  assert.equal(legacy.dietStyle, "gluten_free");
  assert.equal(serializeUserProfileForFirestore(legacy).dietStyle, "gluten_free");
});

test("invalid culinary choices remain absent rather than becoming fast or mediterranean", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Invalid culinary",
    cookingSpeed: "instant",
    dietStyle: "whatever",
  });

  assert.equal(profile.cookingSpeed, undefined);
  assert.equal(profile.dietStyle, undefined);

  const serialized = serializeUserProfileForFirestore(profile);
  assert.equal(serialized.cookingSpeed, null);
  assert.equal(serialized.dietStyle, null);
});
