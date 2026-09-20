import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("profile correction controls exist only inside existing HealthProfile rows", () => {
  assert.match(source, /healthFieldRows\.map/);
  assert.match(source, /profile-edit-health-field-/);
  assert.match(source, /profile-health-edit-panel-/);
  assert.match(source, /correctExistingHealthProfileField\(/);
  assert.doesNotMatch(source, /profile-add-health-field/);
});

test("health correction exposes explicit status and value controls without inference", () => {
  assert.match(source, /profile-health-edit-status-/);
  assert.match(source, /HEALTH_STATUS_OPTIONS/);
  assert.match(source, /profile-health-edit-value-/);
  assert.match(source, /NUMERIC_HEALTH_FIELDS/);
  assert.match(source, /HEALTH_FIELD_KNOWN_VALUES/);
});

test("saving a correction records self-reported provenance through the deterministic boundary", () => {
  assert.match(source, /recordedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(source, /onUpdateProfile\(\{ healthProfile: result\.profile \}\)/);
  assert.match(source, /Save correction/);
  assert.match(source, /Saving records this correction as self-reported with a new date/);
});

test("cancel correction has no profile mutation", () => {
  assert.match(source, /const cancelHealthFieldCorrection = \(\) =>/);
  assert.match(source, /setHealthFieldEdit\(null\)/);
  assert.match(source, /profile-cancel-health-field-/);
});
