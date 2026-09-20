import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DEFAULT_PROFILE } from "../src/data/initialData";
import { parseGuestProfileCache } from "../src/utils/profileSyncBoundary";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const onboardingSource = fs.readFileSync(
  new URL("../src/components/OnboardingModal.tsx", import.meta.url),
  "utf8",
);
const mainSource = fs.readFileSync(
  new URL("../src/main.tsx", import.meta.url),
  "utf8",
);
const runtimeQaGateSource = fs.readFileSync(
  new URL("../src/qa/runtimeQaGate.ts", import.meta.url),
  "utf8",
);

test("fresh guest defaults cannot silently claim onboarding completion", () => {
  assert.equal(DEFAULT_PROFILE.onboardingCompleted, false);
  assert.match(
    appSource,
    /parseGuestProfileCache\(localStorage\.getItem\("balkanbite_profile"\)\)\s*\?\?\s*DEFAULT_PROFILE/,
  );
  assert.match(
    appSource,
    /isOpen=\{!showLanding && !profile\.onboardingCompleted\}/,
  );
});

test("existing saved guest onboarding completion remains user-owned state", () => {
  const saved = parseGuestProfileCache(
    JSON.stringify({
      ...DEFAULT_PROFILE,
      name: "Guest",
      onboardingCompleted: true,
    }),
  );

  assert.ok(saved);
  assert.equal(saved?.name, "Guest");
  assert.equal(saved?.onboardingCompleted, true);
});

test("current culinary onboarding does not collect HealthProfile physiological inputs", () => {
  for (const forbidden of [
    "healthProfile",
    "ageYears",
    "heightCm",
    "weightKg",
    "physiologicalSex",
    "activityCategory",
    "pregnancyLactationStatus",
  ]) {
    assert.equal(
      onboardingSource.includes(forbidden),
      false,
      `culinary onboarding must not collect health field: ${forbidden}`,
    );
  }

  assert.match(onboardingSource, /cookingSpeed/);
  assert.match(onboardingSource, /dietStyle/);
  assert.match(onboardingSource, /householdSize/);
  assert.match(onboardingSource, /monthlyBudgetEUR/);
  assert.match(onboardingSource, /onboardingCompleted:\s*true/);
});


test("onboarding modal keeps hook order stable when completion closes it", () => {
  const firstUseState = onboardingSource.indexOf("useState");
  const closedReturn = onboardingSource.indexOf("if (!isOpen) return null");
  assert.ok(firstUseState >= 0);
  assert.ok(
    closedReturn > firstUseState,
    "conditional close return must occur after onboarding hooks",
  );
});

test("fresh-guest onboarding has an isolated runtime QA route", () => {
  assert.match(runtimeQaGateSource, /\/__qa\/fresh-guest-onboarding/);
  assert.match(runtimeQaGateSource, /isFreshGuestOnboardingQaRoute/);
  assert.match(mainSource, /FreshGuestOnboardingQaHarness/);
});
