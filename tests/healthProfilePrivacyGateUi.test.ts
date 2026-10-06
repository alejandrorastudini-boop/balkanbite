import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("Profile does not collect new persistent health fields while privacy gate is open", () => {
  assert.doesNotMatch(source, /health-profile-entry-card/);
  assert.doesNotMatch(source, /add-health-field-/);
  assert.doesNotMatch(source, /setSelfReportedHealthProfileField/);
});

test("existing health data remains inspectable, correctable, removable and calculation stays explicit", () => {
  assert.match(source, /profile-health-field-list/);
  assert.match(source, /correctExistingHealthProfileField/);
  assert.match(source, /profile-remove-health-field-/);
  assert.match(source, /profile-calculate-maintenance-energy/);
});
