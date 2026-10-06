import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/ProfileView.tsx", "utf8");

test("maintenance-energy result is bound to the exact current HealthProfile inputs", () => {
  assert.match(source, /maintenanceEnergyInputKey = JSON\.stringify\(maintenanceEnergyInput\)/);
  assert.match(source, /maintenanceEnergyCalculation\?\.inputKey === maintenanceEnergyInputKey/);
  assert.match(source, /inputKey: maintenanceEnergyInputKey/);
});

test("maintenance-energy calculation uses the same input snapshot that is keyed", () => {
  assert.match(source, /estimateAdultMaintenanceEnergyEfsa2013\(maintenanceEnergyInput\)/);
});
