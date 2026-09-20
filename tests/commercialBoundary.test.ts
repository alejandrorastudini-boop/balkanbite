import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const landingSource = readFileSync(
  new URL("../src/components/LandingPage.tsx", import.meta.url),
  "utf8"
);
const landingDataSource = readFileSync(
  new URL("../src/data/landingData.ts", import.meta.url),
  "utf8"
);
const proModalSource = readFileSync(
  new URL("../src/components/ProModal.tsx", import.meta.url),
  "utf8"
);
const initialDataSource = readFileSync(
  new URL("../src/data/initialData.ts", import.meta.url),
  "utf8"
);
const shoppingSource = readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8"
);
const mealPlanSource = readFileSync(
  new URL("../src/components/MealPlanView.tsx", import.meta.url),
  "utf8"
);
const profileSource = readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8"
);
const headerSource = readFileSync(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8"
);
const translationsSource = readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8"
);

test("non-existent Pro entitlement cannot gate current product functionality", () => {
  assert.doesNotMatch(appSource, /hasVerifiedProEntitlement/);
  assert.doesNotMatch(appSource, /if \(!profile\.isProSubscriber\)/);
  assert.doesNotMatch(appSource, /isPro=\{profile\.isProSubscriber\}/);
  assert.doesNotMatch(appSource, /isProSubscriber:\s*!prev\.isProSubscriber/);
  assert.match(initialDataSource, /isProSubscriber:\s*false/);

  const start = appSource.indexOf("const handleGenerateAiWeekPlan");
  const end = appSource.indexOf("const handleResetApp", start);
  assert.ok(start >= 0 && end > start);
  const weeklyPlanHandler = appSource.slice(start, end);

  assert.match(weeklyPlanHandler, /requireAuthoritativeInventory/);
  assert.match(weeklyPlanHandler, /requireFoodRecommendationSafetyReview/);
  assert.match(weeklyPlanHandler, /\/api\/ai\/generate-weekly-plan/);
  assert.doesNotMatch(weeklyPlanHandler, /setShowProModal|isPro|entitlement/i);

  assert.doesNotMatch(mealPlanSource, /\bisPro\b|onOpenProModal/);
  assert.match(mealPlanSource, /id="generate-ai-week-plan-btn"/);
});

test("Pro UI cannot activate a fake subscription or billing state", () => {
  assert.doesNotMatch(proModalSource, /onTogglePro/);
  assert.doesNotMatch(proModalSource, /monthlyPrice|annualPrice|billingCycle/);
  assert.doesNotMatch(proModalSource, /Activate BalkanBite Pro|Activar BalkanBite Pro|Активирай BalkanBite Pro/);
  assert.match(proModalSource, /No subscription, billing, or trial is currently enabled/);
  assert.match(proModalSource, /This screen does not activate any Pro capability/);
});

test("landing does not advertise an active free trial, fabricated social proof, or guaranteed ROI", () => {
  const combined = landingSource + "\n" + landingDataSource;

  for (const forbidden of [
    "Try 7 Days Free",
    "Start 7-Day Free Trial",
    "Probar 7 Días Gratis",
    "8,500+ homes",
    "8.500 hogares",
    "4.9 / 5",
    "1,200+ reviews",
    "ROI guaranteed",
    "Te ahorra más de 120 €",
    "Гарантирана възвръщаемост",
  ]) {
    assert.equal(
      combined.includes(forbidden),
      false,
      `landing must not contain unsupported commercial/social-proof claim: ${forbidden}`
    );
  }

  assert.match(landingDataSource, /subscription billing is not enabled/);
  assert.match(landingDataSource, /PRO not available yet/);
  assert.match(
    landingSource,
    /disabled className="mt-6 w-full py-3 rounded-xl bg-stone-800/
  );
});

test("landing scanner copy preserves the human-review authority boundary", () => {
  assert.match(
    landingDataSource,
    /Before adding an item you must explicitly confirm quantity and unit/
  );
  assert.match(
    landingDataSource,
    /suggested price and expiry are not saved as authoritative data/
  );
  assert.doesNotMatch(landingDataSource, /Gemini 3\.8 Flash Vision/);
  assert.doesNotMatch(landingDataSource, /exact grocery list|lista de compras exacta/i);
  assert.doesNotMatch(landingDataSource, /zero lag/i);
  assert.doesNotMatch(landingDataSource, /desde 0,85|under €1\.00/i);
});


test("shopping UI does not claim fixed savings without a verified calculation", () => {
  for (const forbidden of [
    "~€14.50",
    "~$16.00",
    "Smart Supermarket Savings Radar",
  ]) {
    assert.equal(
      shoppingSource.includes(forbidden),
      false,
      `shopping UI must not contain unsupported savings claim: ${forbidden}`
    );
  }

  assert.doesNotMatch(
    shoppingSource,
    /currency\s*===\s*"EUR"[\s\S]{0,120}ahorro|спестяване|savings/
  );
});


test("landing budget scenario never applies an unverified hardcoded FX rate", () => {
  assert.doesNotMatch(landingSource, /currRatio/);
  assert.doesNotMatch(
    landingSource,
    /currency\s*===\s*"EUR"\s*\?\s*1\s*:\s*1\.08/
  );
  assert.match(
    landingSource,
    /No live exchange rate is applied/
  );
  assert.match(
    landingSource,
    /Amounts are shown directly in the selected currency/
  );
});


test("commercial UI presents Pro only as an unavailable future concept", () => {
  assert.doesNotMatch(headerSource, /header-pro-badge|BalkanBite Pro Tier/);
  assert.match(profileSource, /id="profile-pro-concept-card"/);
  assert.match(profileSource, /Future concept/);
  assert.match(profileSource, /There is no active Pro subscription or billing/);
  assert.match(profileSource, /Pricing, limits, and future Pro features are not defined yet/);
});

test("legacy translations cannot reintroduce invented Pro price, trial, or paywall claims", () => {
  for (const forbidden of [
    "3.99€ / month",
    "3.99€ / месец",
    "3.99€ / mes",
    "Try 7 Days Free",
    "Опитай 7 дни безплатно",
    "Probar 7 Días Gratis",
    "Active Subscription",
    "Активен абонамент",
    "Suscripción Activa",
    "Unlock unlimited meal generation",
    "неограничени менюта",
    "menús semanales ilimitados",
  ]) {
    assert.equal(
      translationsSource.includes(forbidden),
      false,
      `translations must not contain stale commercial claim: ${forbidden}`,
    );
  }

  assert.match(translationsSource, /mealPlanAiBadge: "AI"/);
  assert.match(translationsSource, /mealPlanAiBadge: "IA"/);
  assert.match(translationsSource, /Pro pricing not defined/);
  assert.match(translationsSource, /Precio Pro no definido/);
});
