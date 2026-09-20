import assert from "node:assert/strict";
import test from "node:test";

import { buildAiCulinaryProfileContext } from "../src/utils/aiCulinaryProfileContext";

test("generic AI context allowlists culinary preferences and drops health/account data", () => {
  const context = buildAiCulinaryProfileContext({
    cookingSpeed: "moderate",
    dietStyle: "vegetarian",
    disliked: [" mushrooms ", "", 42],
    allergies: ["peanuts"],
    householdSize: 3,
    appliances: ["Airfryer", "Oven"],
    monthlyBudgetEUR: 240,
    healthGoal: "fat_loss",
    healthProfile: {
      version: 1,
      weightKg: { status: "known", value: 80 },
      physiologicalSex: { status: "known", value: "male" },
    },
    isProSubscriber: true,
    onboardingCompleted: true,
    name: "Alex",
    language: "es",
    currency: "EUR",
  });

  assert.deepEqual(context, {
    cookingSpeed: "moderate",
    dietStyle: "vegetarian",
    disliked: ["mushrooms"],
    allergies: ["peanuts"],
    householdSize: 3,
    appliances: ["Airfryer", "Oven"],
    monthlyBudgetEUR: 240,
  });

  assert.equal("healthGoal" in context, false);
  assert.equal("healthProfile" in context, false);
  assert.equal("isProSubscriber" in context, false);
  assert.equal("name" in context, false);
});

test("generic AI context invents no defaults for missing or invalid preferences", () => {
  assert.deepEqual(buildAiCulinaryProfileContext(undefined), {});
  assert.deepEqual(
    buildAiCulinaryProfileContext({
      cookingSpeed: "unknown",
      dietStyle: "medical-keto",
      householdSize: 0,
      monthlyBudgetEUR: Number.NaN,
      disliked: [null, 7],
      appliances: [],
    }),
    {},
  );
});
