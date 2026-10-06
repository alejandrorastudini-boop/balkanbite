import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("profile keeps new persistent HealthProfile collection unavailable while privacy gate is open", () => {
  assert.doesNotMatch(source, /health-profile-entry-card/);
  assert.doesNotMatch(source, /missingHealthFields/);
  assert.doesNotMatch(source, /beginHealthFieldEntry/);
  assert.doesNotMatch(source, /setSelfReportedHealthProfileField/);
});

test("existing HealthProfile controls remain available without soliciting missing fields", () => {
  assert.match(source, /profile-health-field-list/);
  assert.match(source, /correctExistingHealthProfileField/);
  assert.match(source, /profile-remove-health-field-/);
  assert.match(source, /profile-calculate-maintenance-energy/);
});
