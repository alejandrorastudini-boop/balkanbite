import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const onboardingSource = fs.readFileSync(
  new URL("../src/components/OnboardingModal.tsx", import.meta.url),
  "utf8",
);
const profileSource = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("onboarding does not collect inactive health goals or promise goal-specific nutrition", () => {
  assert.doesNotMatch(onboardingSource, /setHealthGoal/);
  assert.doesNotMatch(onboardingSource, /healthGoal,/);
  assert.doesNotMatch(onboardingSource, /Pérdida de Grasa/);
  assert.doesNotMatch(onboardingSource, /Ganancia Muscular/);
  assert.doesNotMatch(onboardingSource, /Salud Cardiovascular/);
  assert.doesNotMatch(onboardingSource, /Recetas con menos calorías/);
});

test("profile does not present healthGoal as an active recommendation control", () => {
  assert.doesNotMatch(profileSource, /currentText\.healthGoals/);
  assert.doesNotMatch(profileSource, /onUpdateProfile\(\{ healthGoal:/);
  assert.doesNotMatch(profileSource, /currentText\.goalFatLoss/);
  assert.doesNotMatch(profileSource, /currentText\.goalHeart/);
});
