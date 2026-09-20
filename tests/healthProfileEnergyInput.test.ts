import assert from "node:assert/strict";
import test from "node:test";

import type { HealthProfile } from "../src/types";
import { estimateAdultMaintenanceEnergyEfsa2013 } from "../src/utils/euAdultMaintenanceEnergy";
import { buildEfsaAdultMaintenanceEnergyInputFromHealthProfile } from "../src/utils/healthProfileEnergyInput";

test("known HealthProfile inputs can feed the EFSA estimator without defaults", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35, source: "self_reported" },
    heightCm: { status: "known", value: 175, source: "measured" },
    weightKg: { status: "known", value: 75, source: "measured" },
    physiologicalSex: {
      status: "known",
      value: "female",
      source: "self_reported",
    },
    activityCategory: {
      status: "known",
      value: "moderately_active",
      source: "self_reported",
    },
    pregnancyLactationStatus: {
      status: "known",
      value: "not_pregnant_or_lactating",
      source: "self_reported",
    },
  };

  const input = buildEfsaAdultMaintenanceEnergyInputFromHealthProfile(profile);
  assert.deepEqual(input, {
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
    physiologicalSex: "female",
    activityCategory: "moderately_active",
    pregnancyLactationStatus: "not_pregnant_or_lactating",
  });

  assert.equal(
    estimateAdultMaintenanceEnergyEfsa2013(input).status,
    "calculated",
  );
});

test("unknown and prefer-not-to-say HealthProfile values stay absent", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35, source: "self_reported" },
    heightCm: { status: "unknown" },
    weightKg: { status: "known", value: 75, source: "measured" },
    physiologicalSex: {
      status: "prefer_not_to_say",
      source: "self_reported",
    },
    activityCategory: { status: "unknown" },
  };

  const input = buildEfsaAdultMaintenanceEnergyInputFromHealthProfile(profile);
  assert.equal(input.heightCm, undefined);
  assert.equal(input.physiologicalSex, undefined);
  assert.equal(input.activityCategory, undefined);
  assert.equal(input.pregnancyLactationStatus, undefined);

  const result = estimateAdultMaintenanceEnergyEfsa2013(input);
  assert.equal(result.status, "insufficient_data");
  if (result.status !== "insufficient_data") return;
  assert.deepEqual(result.missing, [
    "heightCm",
    "physiologicalSex",
    "activityCategory",
  ]);
});

test("female profile never assumes absence of pregnancy/lactation", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35 },
    heightCm: { status: "known", value: 175 },
    weightKg: { status: "known", value: 75 },
    physiologicalSex: { status: "known", value: "female" },
    activityCategory: { status: "known", value: "low_active" },
  };

  const result = estimateAdultMaintenanceEnergyEfsa2013(
    buildEfsaAdultMaintenanceEnergyInputFromHealthProfile(profile),
  );

  assert.deepEqual(result, {
    status: "insufficient_data",
    missing: ["pregnancyLactationStatus"],
  });
});
