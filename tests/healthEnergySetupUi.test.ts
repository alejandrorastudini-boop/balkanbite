import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/components/HealthEnergySetupCard.tsx", import.meta.url), "utf8");
const profile = fs.readFileSync(new URL("../src/components/ProfileView.tsx", import.meta.url), "utf8");

test("progressive setup requests only the first currently required field", () => {
  assert.match(source, /plan\.fieldsToRequest\[0\]/);
  assert.match(source, /No defaults are used/);
  assert.match(profile, /maintenanceEnergyPlan\.status === "needs_input"/);
});

test("setup requires an explicit status and supports uncertainty or refusal", () => {
  assert.match(source, /value="unknown"/);
  assert.match(source, /value="prefer_not_to_say"/);
  assert.match(source, /value="not_applicable"/);
  assert.match(source, /<option value="">/);
});

test("setup persists through the fail-closed self-reported entry primitive", () => {
  assert.match(source, /setSelfReportedHealthProfileField/);
  assert.match(source, /recordedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(profile, /persistPreference\(\{ healthProfile \}\)/);
});
