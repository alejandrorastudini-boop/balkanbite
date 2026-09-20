import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const onboardingSource = fs.readFileSync(
  new URL("../src/components/OnboardingModal.tsx", import.meta.url),
  "utf8",
);

test("onboarding does not collect legacy allergy/intolerance labels", () => {
  assert.doesNotMatch(onboardingSource, /selectedAllergies/);
  assert.doesNotMatch(onboardingSource, /toggleAllergy/);
  assert.doesNotMatch(onboardingSource, /allergies:\s*selectedAllergies/);
});

test("onboarding does not offer legacy gluten-free or keto as ordinary diet preferences", () => {
  assert.doesNotMatch(onboardingSource, /id:\s*"gluten_free"/);
  assert.doesNotMatch(onboardingSource, /id:\s*"keto"/);
});
