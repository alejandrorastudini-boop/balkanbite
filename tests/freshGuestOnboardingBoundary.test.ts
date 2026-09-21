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
  assert.equal(DEFAULT_PROFILE.cookingSpeed, undefined);
  assert.equal(DEFAULT_PROFILE.dietStyle, undefined);
  assert.equal(DEFAULT_PROFILE.healthGoal, undefined);
  assert.equal(DEFAULT_PROFILE.budgetTier, undefined);
  assert.match(
    appSource,
    /parseGuestProfileCache\(localStorage\.getItem\("balkanbite_profile"\)\)\s*\?\?\s*DEFAULT_PROFILE/,
  );
  assert.match(
    appSource,
    /isOpen=\{\s*!showLanding\s*&&\s*\(!currentUser \|\| profileHydrated\)\s*&&\s*!profile\.onboardingCompleted\s*\}/,
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


test("onboarding navigation labels follow the selected language", () => {
  assert.doesNotMatch(onboardingSource, /<span>Siguiente<\/span>/);
  assert.match(
    onboardingSource,
    /language === "bg" \? "Напред" : language === "es" \? "Siguiente" : "Next"/,
  );
  assert.match(
    onboardingSource,
    /language === "bg" \? "Започни" : language === "es" \? "Comenzar Experiencia" : "Start Experience"/,
  );
});


test("onboarding does not preselect household culinary preferences or budget", () => {
  assert.match(
    onboardingSource,
    /useState<number \| null>\(null\)/,
  );
  assert.match(
    onboardingSource,
    /"fast" \| "moderate" \| "elaborate" \| null[\s\S]*>\(null\)/,
  );
  assert.match(
    onboardingSource,
    /"all" \| "mediterranean" \| "vegetarian" \| "vegan" \| null[\s\S]*>\(null\)/,
  );
  assert.match(
    onboardingSource,
    /monthlyBudgetEURInput, setMonthlyBudgetEURInput\] = useState\(""\)/,
  );
  assert.doesNotMatch(onboardingSource, /useState<number>\(350\)/);
  assert.doesNotMatch(onboardingSource, /type="range"/);
  assert.doesNotMatch(onboardingSource, /3-4 \(Familia\)|5\+ \(Grande\)/);
});

test("onboarding requires explicit household diet and cooking choices", () => {
  assert.match(onboardingSource, /disabled=\{householdSize === null\}/);
  assert.match(onboardingSource, /disabled=\{dietStyle === null\}/);
  assert.match(onboardingSource, /disabled=\{cookingSpeed === null\}/);
  assert.match(onboardingSource, /id="onboarding-household-size"/);
  assert.match(onboardingSource, /id=\{\`onboarding-diet-\$\{opt\.id\}\`\}/);
  assert.match(onboardingSource, /id=\{\`onboarding-cooking-\$\{opt\.id\}\`\}/);
});

test("blank onboarding budget stays absent instead of becoming zero or a default", () => {
  assert.match(onboardingSource, /trimmedBudget\.length > 0 \? Number\(trimmedBudget\) : undefined/);
  assert.match(
    onboardingSource,
    /\.\.\.\(parsedBudget !== undefined[\s\S]*\? \{ monthlyBudgetEUR: parsedBudget \}[\s\S]*: \{\}\)/,
  );
  assert.match(onboardingSource, /Leave blank if you do not want to set a budget/);
});
