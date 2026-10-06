import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("maintenance estimate is explicit opt-in and uses the EFSA profile adapter", () => {
  assert.match(source, /profile-calculate-maintenance-energy/);
  assert.match(source, /planAdultMaintenanceEnergyCollection/);
  assert.match(source, /buildEfsaAdultMaintenanceEnergyInputFromHealthProfile/);
  assert.match(source, /estimateAdultMaintenanceEnergyEfsa2013/);
});

test("maintenance estimate is labelled estimate and not persisted as a target", () => {
  assert.match(source, /not a calorie target or medical prescription/);
  assert.match(source, /Not stored as a daily target/);
  assert.doesNotMatch(source, /onUpdateProfile\(\{[^}]*calorie/i);
});
