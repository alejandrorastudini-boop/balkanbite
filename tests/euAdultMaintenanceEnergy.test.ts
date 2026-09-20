import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateAdultMaintenanceEnergyEfsa2013,
  type EfsaAdultPhysicalActivityCategory,
  type EfsaAdultEnergySex,
} from "../src/utils/euAdultMaintenanceEnergy";

const cases: Array<{
  sex: EfsaAdultEnergySex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  expectedReeExact: number;
}> = [
  {
    sex: "male",
    ageYears: 25,
    heightCm: 178,
    weightKg: 70,
    expectedReeExact: 1678.14,
  },
  {
    sex: "male",
    ageYears: 40,
    heightCm: 176,
    weightKg: 72,
    expectedReeExact: 1635.96,
  },
  {
    sex: "male",
    ageYears: 65,
    heightCm: 173,
    weightKg: 79,
    expectedReeExact: 1580.53,
  },
  {
    sex: "female",
    ageYears: 25,
    heightCm: 164,
    weightKg: 56,
    expectedReeExact: 1309,
  },
  {
    sex: "female",
    ageYears: 40,
    heightCm: 164,
    weightKg: 60,
    expectedReeExact: 1302.48,
  },
  {
    sex: "female",
    ageYears: 65,
    heightCm: 160,
    weightKg: 60,
    expectedReeExact: 1195.5,
  },
];

const palCases: Array<{
  activity: EfsaAdultPhysicalActivityCategory;
  pal: 1.4 | 1.6 | 1.8 | 2.0;
}> = [
  { activity: "low_active", pal: 1.4 },
  { activity: "moderately_active", pal: 1.6 },
  { activity: "active", pal: 1.8 },
  { activity: "very_active", pal: 2.0 },
];

for (const base of cases) {
  for (const { activity, pal } of palCases) {
    test(`EFSA 2013 Henry: ${base.sex} age ${base.ageYears} / ${activity}`, () => {
      const result = estimateAdultMaintenanceEnergyEfsa2013({
        ageYears: base.ageYears,
        heightCm: base.heightCm,
        weightKg: base.weightKg,
        physiologicalSex: base.sex,
        activityCategory: activity,
        ...(base.sex === "female"
          ? { pregnancyLactationStatus: "not_pregnant_or_lactating" }
          : {}),
      });

      assert.equal(result.status, "calculated");
      if (result.status !== "calculated") return;
      assert.equal(result.restingEnergyKcalPerDay, Math.round(base.expectedReeExact));
      assert.equal(result.physicalActivityLevel, pal);
      assert.equal(
        result.estimatedKcalPerDay,
        Math.round(base.expectedReeExact * pal),
      );
      assert.equal(result.formulaVersion, "efsa_2013_henry_2005_adult_v1");
      assert.equal(result.source.doi, "10.2903/j.efsa.2013.3005");
      assert.equal(result.source.populationContext, "Europe");
      assert.deepEqual(result.uncertainty, {
        quantified: false,
        factors: [
          "resting_energy_prediction",
          "physical_activity_level_selection",
        ],
      });
    });
  }
}

test("does not invent inputs needed by the EFSA method", () => {
  const result = estimateAdultMaintenanceEnergyEfsa2013({
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
  });

  assert.deepEqual(result, {
    status: "insufficient_data",
    missing: ["physiologicalSex", "activityCategory"],
  });
});

test("female equation requires explicit pregnancy/lactation status", () => {
  const result = estimateAdultMaintenanceEnergyEfsa2013({
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
    physiologicalSex: "female",
    activityCategory: "low_active",
  });

  assert.deepEqual(result, {
    status: "insufficient_data",
    missing: ["pregnancyLactationStatus"],
  });
});

test("pregnancy/lactation stays outside the general adult estimator", () => {
  const result = estimateAdultMaintenanceEnergyEfsa2013({
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
    physiologicalSex: "female",
    activityCategory: "low_active",
    pregnancyLactationStatus: "pregnant_or_lactating",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "pregnancy_or_lactation_requires_specialized_path",
  });
});

test("under-19 users stay outside this adult estimator", () => {
  const result = estimateAdultMaintenanceEnergyEfsa2013({
    ageYears: 18,
    heightCm: 170,
    weightKg: 65,
    physiologicalSex: "male",
    activityCategory: "low_active",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "age_under_19",
  });
});
