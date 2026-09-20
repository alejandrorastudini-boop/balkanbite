import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateAdultMaintenanceEnergy,
  type AdultPhysicalActivityCategory,
  type PhysiologicalSexForEnergyEquation,
} from "../src/utils/adultMaintenanceEnergy";

const expectedByEquation: Array<{
  sex: PhysiologicalSexForEnergyEquation;
  activity: AdultPhysicalActivityCategory;
  expected: number;
}> = [
  { sex: "male", activity: "inactive", expected: 2569 },
  { sex: "male", activity: "low_active", expected: 2775 },
  { sex: "male", activity: "active", expected: 2960 },
  { sex: "male", activity: "very_active", expected: 3268 },
  { sex: "female", activity: "inactive", expected: 2219 },
  { sex: "female", activity: "low_active", expected: 2396 },
  { sex: "female", activity: "active", expected: 2535 },
  { sex: "female", activity: "very_active", expected: 2796 },
];

for (const { sex, activity, expected } of expectedByEquation) {
  test(`2023 adult EER equation: ${sex} / ${activity}`, () => {
    const result = estimateAdultMaintenanceEnergy({
      ageYears: 35,
      heightCm: 175,
      weightKg: 75,
      physiologicalSex: sex,
      activityCategory: activity,
      ...(sex === "female"
        ? { pregnancyLactationStatus: "not_pregnant_or_lactating" }
        : {}),
    });

    assert.equal(result.status, "calculated");
    if (result.status !== "calculated") return;
    assert.equal(result.estimatedKcalPerDay, expected);
    assert.equal(result.formulaVersion, "nasem_dri_energy_2023_adult_v1");
    assert.equal(result.source.year, 2023);
    assert.equal(result.source.doi, "10.17226/26818");
    assert.deepEqual(result.modelError, {
      metric: "mean_absolute_error",
      kcalPerDay: sex === "male" ? 266 : 191,
    });
  });
}

test("never invents missing inputs", () => {
  const result = estimateAdultMaintenanceEnergy({
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
  const result = estimateAdultMaintenanceEnergy({
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
    physiologicalSex: "female",
    activityCategory: "inactive",
  });

  assert.deepEqual(result, {
    status: "insufficient_data",
    missing: ["pregnancyLactationStatus"],
  });
});

test("pregnancy or lactation is blocked instead of using the general adult equation", () => {
  const result = estimateAdultMaintenanceEnergy({
    ageYears: 35,
    heightCm: 175,
    weightKg: 75,
    physiologicalSex: "female",
    activityCategory: "inactive",
    pregnancyLactationStatus: "pregnant_or_lactating",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "pregnancy_or_lactation_requires_specialized_equation",
  });
});

test("under-19 inputs are outside this adult primitive", () => {
  const result = estimateAdultMaintenanceEnergy({
    ageYears: 18,
    heightCm: 170,
    weightKg: 65,
    physiologicalSex: "male",
    activityCategory: "inactive",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "age_under_19",
  });
});

test("invalid numeric or categorical values are rejected", () => {
  const result = estimateAdultMaintenanceEnergy({
    ageYears: Number.NaN,
    heightCm: -170,
    weightKg: 0,
    physiologicalSex: "unknown",
    activityCategory: "sedentary",
  });

  assert.deepEqual(result, {
    status: "invalid_input",
    invalid: [
      "ageYears",
      "heightCm",
      "weightKg",
      "physiologicalSex",
      "activityCategory",
    ],
  });
});
