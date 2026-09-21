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
const headerSource = readFileSync(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8"
);
const profileSource = readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8"
);
const translationsSource = readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8"
);
const serviceWorkerSource = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
);

test("weekly AI planning is not gated by a non-existent commercial entitlement", () => {
  assert.doesNotMatch(appSource, /hasVerifiedProEntitlement/);
  assert.doesNotMatch(appSource, /if \(!profile\.isProSubscriber\)/);
  assert.doesNotMatch(appSource, /isPro=\{/);
  assert.doesNotMatch(appSource, /isProSubscriber:\s*!prev\.isProSubscriber/);
  assert.doesNotMatch(initialDataSource, /isProSubscriber/);

  const start = appSource.indexOf("const handleGenerateAiWeekPlan");
  const end = appSource.indexOf("const handleResetApp", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);

  assert.match(handler, /requireAuthoritativeInventory\(\)/);
  assert.match(handler, /requireFoodRecommendationSafetyReview\(\)/);
  assert.match(handler, /setIsGeneratingPlan\(true\)/);
  assert.doesNotMatch(handler, /setShowProModal/);
  assert.doesNotMatch(handler, /ProEntitlement|isProSubscriber/);
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


test("weekly planner and shopping surfaces contain no dead Pro gating props", () => {
  assert.doesNotMatch(mealPlanSource, /\bisPro\b/);
  assert.doesNotMatch(mealPlanSource, /onOpenProModal/);
  assert.match(mealPlanSource, /onClick=\{onGenerateAiWeekPlan\}/);
  assert.match(mealPlanSource, /id="meal-plan-generate-ai-week"/);
  assert.doesNotMatch(mealPlanSource, /Desbloquear Planificador IA/);
  assert.doesNotMatch(shoppingSource, /\bisPro\b/);
  assert.doesNotMatch(shoppingSource, /onOpenProModal/);
});

test("header does not advertise a persistent Pro tier", () => {
  assert.doesNotMatch(headerSource, /header-pro-badge/);
  assert.doesNotMatch(headerSource, /BalkanBite Pro Tier/);
  assert.doesNotMatch(headerSource, /onOpenProModal/);
});

test("profile Pro surface is explicitly a future concept, not an active subscription", () => {
  assert.match(profileSource, /\{currentText\.activePro\}/);
  assert.match(profileSource, /\{currentText\.manageSub\}/);
  assert.match(proModalSource, /future product concept/);
  assert.match(proModalSource, /No subscription, billing, or trial is currently enabled/);
});

test("translations contain no legacy price, trial, active-tier, or unlock claims", () => {
  for (const forbidden of [
    "3.99€",
    "Try 7 Days Free",
    "Probar 7 Días Gratis",
    "Опитай 7 дни безплатно",
    "BalkanBite Pro (Active)",
    "BalkanBite Pro (Activo)",
    "BalkanBite Pro (Активен)",
    "Upgrade to unlock unlimited meal generation",
    "Pasa a PRO para desbloquear menús semanales ilimitados",
    "Активирайте PRO за неограничени менюта",
  ]) {
    assert.equal(
      translationsSource.includes(forbidden),
      false,
      `translations must not contain stale commercial claim: ${forbidden}`,
    );
  }

  assert.match(translationsSource, /No active subscription/);
  assert.match(translationsSource, /No hay suscripción activa/);
  assert.match(translationsSource, /Няма активен абонамент/);
  assert.match(translationsSource, /Pricing, limits, and packaging are not defined yet/);
});


test("PWA copy does not promise offline use while service worker is retirement-only", () => {
  assert.match(serviceWorkerSource, /unregister/i);
  assert.match(serviceWorkerSource, /caches\.keys/);

  for (const forbidden of [
    "instant offline access",
    "sin conexión",
    "offline mode",
  ]) {
    assert.equal(
      translationsSource.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `translations must not promise unsupported offline use: ${forbidden}`,
    );
  }

  assert.match(
    translationsSource,
    /Cloud sync and AI features require an internet connection/,
  );
  assert.doesNotMatch(translationsSource, /Instant synchronization/);
  assert.doesNotMatch(translationsSource, /Sincronización instantánea/);
  assert.doesNotMatch(translationsSource, /Мигновена синхронизация/);
  assert.match(
    translationsSource,
    /La sincronización en la nube y las funciones de IA requieren conexión a internet/,
  );
});

test("translations contain no guaranteed-savings or absolute privacy claims", () => {
  for (const forbidden of [
    "guaranteed savings",
    "ahorro garantizado",
    "100% protected",
    "100% respetada",
    "never shared",
    "никога не се споделят",
  ]) {
    assert.equal(
      translationsSource.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `translations must not contain unsupported trust claim: ${forbidden}`,
    );
  }

  assert.match(
    translationsSource,
    /track spending from the data you provide/,
  );
  assert.match(
    translationsSource,
    /Sigue tu gasto a partir de los datos que proporciones/,
  );
  assert.match(
    translationsSource,
    /See the Privacy Policy for how account and cloud data are handled/,
  );
});

test("scan copy explicitly preserves human confirmation authority", () => {
  for (const forbidden of [
    "detect food instantly",
    "detectar alimentos al instante",
    "perfect detection",
    "detección perfecta",
    "точно разпознаване",
  ]) {
    assert.equal(
      translationsSource.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `scan copy must not imply perfect or instant authoritative detection: ${forbidden}`,
    );
  }

  assert.match(translationsSource, /AI can be wrong/);
  assert.match(translationsSource, /confirm each item before adding it/);
  assert.match(translationsSource, /La IA puede equivocarse/);
  assert.match(translationsSource, /Confirma cada alimento antes de añadirlo/);
  assert.match(translationsSource, /AI може да греши/);
  assert.match(translationsSource, /Потвърдете всеки продукт преди добавяне/);
});


test("canonical profile schema contains no mock Pro subscription state", () => {
  assert.doesNotMatch(initialDataSource, /isProSubscriber/);
  assert.doesNotMatch(appSource, /profile\.isProSubscriber/);
});
