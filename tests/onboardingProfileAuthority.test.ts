import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const onboarding = readFileSync(new URL("../src/components/OnboardingModal.tsx", import.meta.url), "utf8");

test("onboarding completion propagates the authoritative profile mutation outcome", () => {
  assert.match(app, /onComplete=\{\(upd\) => handleProfileUpdate\(upd\)\}/);
  assert.doesNotMatch(app, /onComplete=\{\(upd\) => \{ void handleProfileUpdate\(upd\); \}\}/);
});

test("onboarding waits for persistence and keeps entries available on failure", () => {
  assert.match(onboarding, /const finish = async \(\) =>/);
  assert.match(onboarding, /const saved = await onComplete/);
  assert.match(onboarding, /if \(saved === false\)/);
  assert.match(onboarding, /setSaveError\(true\)/);
  assert.match(onboarding, /disabled=\{isSaving\}/);
});

test("onboarding marks completion only in the mutation payload", () => {
  assert.match(onboarding, /onboardingCompleted: true/);
  assert.doesNotMatch(onboarding, /setProfile/);
});
