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

test("legacy profile Pro flag is not accepted as a verified commercial entitlement", () => {
  assert.match(appSource, /const hasVerifiedProEntitlement = false;/);
  assert.doesNotMatch(appSource, /if \(!profile\.isProSubscriber\)/);
  assert.doesNotMatch(appSource, /isPro=\{profile\.isProSubscriber\}/);
  assert.doesNotMatch(appSource, /isProSubscriber:\s*!prev\.isProSubscriber/);
  assert.match(initialDataSource, /isProSubscriber:\s*false/);
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
