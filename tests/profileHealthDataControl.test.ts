import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("profile exposes a dedicated HealthProfile deletion control only when health data exists", () => {
  assert.match(source, /profile\.healthProfile\s*&&/);
  assert.match(source, /profile-clear-health-data-btn/);
  assert.match(source, /onUpdateProfile\(\{ healthProfile: undefined \}\)/);
});

test("health-data deletion copy explicitly preserves unrelated account data", () => {
  assert.match(
    source,
    /Tu despensa, recetas, menú y cuenta no se borrarán\./,
  );
  assert.match(
    source,
    /Your pantry, recipes, meal plan, and account will not be deleted\./,
  );
});


test("profile renders only existing HealthProfile fields with status/provenance controls", () => {
  assert.match(source, /HEALTH_PROFILE_FIELD_KEYS\.flatMap/);
  assert.match(source, /healthStatusLabel\(datum\.status, language\)/);
  assert.match(source, /healthValueLabel\(field, datum, language\)/);
  assert.match(source, /healthSourceLabel\(datum\.source, language\)/);
  assert.match(source, /healthRecordedAtLabel\(datum\.recordedAt, language\)/);
  assert.match(source, /profile-health-field-/);
});

test("each HealthProfile row exposes a dedicated remove action without adding collection inputs", () => {
  assert.match(source, /profile-remove-health-field-/);
  assert.match(source, /removeHealthProfileField\(/);
  assert.match(source, /pendingHealthFieldRemoval/);
  assert.doesNotMatch(source, /profile-add-health-field/);
});
