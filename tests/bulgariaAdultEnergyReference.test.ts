import assert from "node:assert/strict";
import test from "node:test";

import {
  getBulgarianAdultAverageEnergyReference2018,
  type BulgarianAdultEnergyActivityCategory,
  type BulgarianAdultEnergySex,
} from "../src/utils/bulgariaAdultEnergyReference";

const publishedRows: Array<{
  sex: BulgarianAdultEnergySex;
  ageYears: number;
  referenceWeightKg: number;
  referenceHeightCm: number;
  values: Partial<Record<BulgarianAdultEnergyActivityCategory, number>>;
}> = [
  {
    sex: "male",
    ageYears: 25,
    referenceWeightKg: 70,
    referenceHeightCm: 178,
    values: {
      low_active: 2344,
      moderately_active: 2679,
      active: 3013,
      very_active: 3348,
    },
  },
  {
    sex: "male",
    ageYears: 40,
    referenceWeightKg: 72,
    referenceHeightCm: 176,
    values: {
      low_active: 2286,
      moderately_active: 2612,
      active: 2939,
      very_active: 3265,
    },
  },
  {
    sex: "male",
    ageYears: 65,
    referenceWeightKg: 79,
    referenceHeightCm: 173,
    values: {
      low_active: 2070,
      moderately_active: 2365,
      active: 2661,
    },
  },
  {
    sex: "male",
    ageYears: 80,
    referenceWeightKg: 68,
    referenceHeightCm: 171,
    values: {
      low_active: 2024,
      moderately_active: 2314,
    },
  },
  {
    sex: "female",
    ageYears: 25,
    referenceWeightKg: 56,
    referenceHeightCm: 164,
    values: {
      low_active: 1828,
      moderately_active: 2089,
      active: 2350,
      very_active: 2612,
    },
  },
  {
    sex: "female",
    ageYears: 40,
    referenceWeightKg: 60,
    referenceHeightCm: 164,
    values: {
      low_active: 1823,
      moderately_active: 2083,
      active: 2343,
      very_active: 2604,
    },
  },
  {
    sex: "female",
    ageYears: 65,
    referenceWeightKg: 60,
    referenceHeightCm: 160,
    values: {
      low_active: 1672,
      moderately_active: 1911,
      active: 2150,
    },
  },
  {
    sex: "female",
    ageYears: 80,
    referenceWeightKg: 55,
    referenceHeightCm: 158,
    values: {
      low_active: 1600,
      moderately_active: 1829,
    },
  },
];

for (const row of publishedRows) {
  for (const [activityCategory, expectedKcal] of Object.entries(row.values)) {
    test(`Bulgarian 2018 Appendix 4: ${row.sex} age ${row.ageYears} / ${activityCategory}`, () => {
      const result = getBulgarianAdultAverageEnergyReference2018({
        ageYears: row.ageYears,
        physiologicalSex: row.sex,
        activityCategory,
      });

      assert.equal(result.status, "reference");
      if (result.status !== "reference") return;
      assert.equal(result.averageKcalPerDay, expectedKcal);
      assert.equal(result.referenceWeightKg, row.referenceWeightKg);
      assert.equal(result.referenceHeightCm, row.referenceHeightCm);
      assert.equal(result.scope.personalized, false);
      assert.equal(result.source.populationContext, "Bulgaria");
      assert.equal(result.source.referenceAnthropometrySurveyYear, 2014);
    });
  }
}

test("does not invent required population-group selectors", () => {
  const result = getBulgarianAdultAverageEnergyReference2018({
    ageYears: 35,
  });

  assert.deepEqual(result, {
    status: "insufficient_data",
    missing: ["physiologicalSex", "activityCategory"],
  });
});

test("under-19 users stay outside the adult reference", () => {
  const result = getBulgarianAdultAverageEnergyReference2018({
    ageYears: 18,
    physiologicalSex: "male",
    activityCategory: "low_active",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "age_under_19",
  });
});

test("activity combinations omitted by the published table stay unsupported", () => {
  const result = getBulgarianAdultAverageEnergyReference2018({
    ageYears: 80,
    physiologicalSex: "female",
    activityCategory: "active",
  });

  assert.deepEqual(result, {
    status: "unsupported",
    reason: "activity_not_defined_for_age_band",
  });
});

test("invalid age or categorical values are rejected", () => {
  const result = getBulgarianAdultAverageEnergyReference2018({
    ageYears: Number.NaN,
    physiologicalSex: "unknown",
    activityCategory: "sedentary",
  });

  assert.deepEqual(result, {
    status: "invalid_input",
    invalid: ["ageYears", "physiologicalSex", "activityCategory"],
  });
});
