export type BulgarianAdultEnergySex = "female" | "male";

export type BulgarianAdultEnergyActivityCategory =
  | "low_active"
  | "moderately_active"
  | "active"
  | "very_active";

export type BulgarianAdultEnergyField =
  | "ageYears"
  | "physiologicalSex"
  | "activityCategory";

export interface BulgarianAdultEnergyReferenceInput {
  ageYears?: unknown;
  /**
   * Physiological sex is used only to select the published reference row.
   * It is not a gender-identity field.
   */
  physiologicalSex?: unknown;
  activityCategory?: unknown;
}

export interface BulgarianAdultEnergyReference {
  status: "reference";
  averageKcalPerDay: number;
  averageMjPerDay: number;
  referenceWeightKg: number;
  referenceHeightCm: number;
  ageBand: "19_to_29" | "30_to_59" | "60_to_74" | "75_plus";
  source: {
    organization: "Ministry of Health of the Republic of Bulgaria";
    instrument: "Ordinance No. 1 of 22 January 2018 on the physiological nutrition norms for the population";
    appendix: 4;
    publication: "State Gazette No. 11 of 2 February 2018";
    populationContext: "Bulgaria";
    referenceAnthropometrySurveyYear: 2014;
  };
  scope: {
    kind: "population_group_average";
    personalized: false;
    normalWeightReference: true;
  };
}

export interface BulgarianAdultEnergyInsufficientData {
  status: "insufficient_data";
  missing: BulgarianAdultEnergyField[];
}

export interface BulgarianAdultEnergyInvalidInput {
  status: "invalid_input";
  invalid: BulgarianAdultEnergyField[];
}

export interface BulgarianAdultEnergyUnsupported {
  status: "unsupported";
  reason: "age_under_19" | "activity_not_defined_for_age_band";
}

export type BulgarianAdultEnergyReferenceResult =
  | BulgarianAdultEnergyReference
  | BulgarianAdultEnergyInsufficientData
  | BulgarianAdultEnergyInvalidInput
  | BulgarianAdultEnergyUnsupported;

type PublishedReferenceRow = {
  referenceWeightKg: number;
  referenceHeightCm: number;
  averageByActivity: Partial<
    Record<
      BulgarianAdultEnergyActivityCategory,
      { mj: number; kcal: number }
    >
  >;
};

const PUBLISHED_REFERENCE_ROWS: Record<
  BulgarianAdultEnergySex,
  Record<BulgarianAdultEnergyReference["ageBand"], PublishedReferenceRow>
> = {
  male: {
    "19_to_29": {
      referenceWeightKg: 70,
      referenceHeightCm: 178,
      averageByActivity: {
        low_active: { mj: 9.81, kcal: 2344 },
        moderately_active: { mj: 11.21, kcal: 2679 },
        active: { mj: 12.61, kcal: 3013 },
        very_active: { mj: 14.0, kcal: 3348 },
      },
    },
    "30_to_59": {
      referenceWeightKg: 72,
      referenceHeightCm: 176,
      averageByActivity: {
        low_active: { mj: 9.56, kcal: 2286 },
        moderately_active: { mj: 10.93, kcal: 2612 },
        active: { mj: 12.29, kcal: 2939 },
        very_active: { mj: 13.66, kcal: 3265 },
      },
    },
    "60_to_74": {
      referenceWeightKg: 79,
      referenceHeightCm: 173,
      averageByActivity: {
        low_active: { mj: 8.66, kcal: 2070 },
        moderately_active: { mj: 9.9, kcal: 2365 },
        active: { mj: 11.13, kcal: 2661 },
      },
    },
    "75_plus": {
      referenceWeightKg: 68,
      referenceHeightCm: 171,
      averageByActivity: {
        low_active: { mj: 8.47, kcal: 2024 },
        moderately_active: { mj: 9.68, kcal: 2314 },
      },
    },
  },
  female: {
    "19_to_29": {
      referenceWeightKg: 56,
      referenceHeightCm: 164,
      averageByActivity: {
        low_active: { mj: 7.65, kcal: 1828 },
        moderately_active: { mj: 8.74, kcal: 2089 },
        active: { mj: 9.83, kcal: 2350 },
        very_active: { mj: 10.93, kcal: 2612 },
      },
    },
    "30_to_59": {
      referenceWeightKg: 60,
      referenceHeightCm: 164,
      averageByActivity: {
        low_active: { mj: 7.63, kcal: 1823 },
        moderately_active: { mj: 8.72, kcal: 2083 },
        active: { mj: 9.8, kcal: 2343 },
        very_active: { mj: 10.89, kcal: 2604 },
      },
    },
    "60_to_74": {
      referenceWeightKg: 60,
      referenceHeightCm: 160,
      averageByActivity: {
        low_active: { mj: 6.99, kcal: 1672 },
        moderately_active: { mj: 7.99, kcal: 1911 },
        active: { mj: 8.99, kcal: 2150 },
      },
    },
    "75_plus": {
      referenceWeightKg: 55,
      referenceHeightCm: 158,
      averageByActivity: {
        low_active: { mj: 6.7, kcal: 1600 },
        moderately_active: { mj: 7.65, kcal: 1829 },
      },
    },
  },
};

function ageBandFor(
  ageYears: number,
): BulgarianAdultEnergyReference["ageBand"] {
  if (ageYears < 30) return "19_to_29";
  if (ageYears < 60) return "30_to_59";
  if (ageYears < 75) return "60_to_74";
  return "75_plus";
}

/**
 * Source-specific Bulgarian population reference.
 *
 * This returns the published average energy requirement for the selected
 * adult population group. It is deliberately NOT a personalized estimate:
 * Appendix 4 uses reference height and body mass medians associated with
 * normal BMI from a nationally representative Bulgarian survey (2014).
 *
 * Do not substitute a user's actual height/weight into this table.
 */
export function getBulgarianAdultAverageEnergyReference2018(
  input: BulgarianAdultEnergyReferenceInput,
): BulgarianAdultEnergyReferenceResult {
  const missing: BulgarianAdultEnergyField[] = [];
  const invalid: BulgarianAdultEnergyField[] = [];

  const ageYears =
    typeof input.ageYears === "number" &&
    Number.isFinite(input.ageYears) &&
    input.ageYears > 0
      ? input.ageYears
      : undefined;
  if (
    input.ageYears === undefined ||
    input.ageYears === null ||
    input.ageYears === ""
  ) {
    missing.push("ageYears");
  } else if (ageYears === undefined) {
    invalid.push("ageYears");
  }

  const physiologicalSex =
    input.physiologicalSex === "female" || input.physiologicalSex === "male"
      ? input.physiologicalSex
      : undefined;
  if (
    input.physiologicalSex === undefined ||
    input.physiologicalSex === null ||
    input.physiologicalSex === ""
  ) {
    missing.push("physiologicalSex");
  } else if (!physiologicalSex) {
    invalid.push("physiologicalSex");
  }

  const activityCategory =
    input.activityCategory === "low_active" ||
    input.activityCategory === "moderately_active" ||
    input.activityCategory === "active" ||
    input.activityCategory === "very_active"
      ? input.activityCategory
      : undefined;
  if (
    input.activityCategory === undefined ||
    input.activityCategory === null ||
    input.activityCategory === ""
  ) {
    missing.push("activityCategory");
  } else if (!activityCategory) {
    invalid.push("activityCategory");
  }

  if (invalid.length > 0) {
    return { status: "invalid_input", invalid };
  }
  if (missing.length > 0) {
    return { status: "insufficient_data", missing };
  }

  if (ageYears! < 19) {
    return { status: "unsupported", reason: "age_under_19" };
  }

  const ageBand = ageBandFor(ageYears!);
  const row = PUBLISHED_REFERENCE_ROWS[physiologicalSex!][ageBand];
  const published = row.averageByActivity[activityCategory!];

  if (!published) {
    return {
      status: "unsupported",
      reason: "activity_not_defined_for_age_band",
    };
  }

  return {
    status: "reference",
    averageKcalPerDay: published.kcal,
    averageMjPerDay: published.mj,
    referenceWeightKg: row.referenceWeightKg,
    referenceHeightCm: row.referenceHeightCm,
    ageBand,
    source: {
      organization: "Ministry of Health of the Republic of Bulgaria",
      instrument:
        "Ordinance No. 1 of 22 January 2018 on the physiological nutrition norms for the population",
      appendix: 4,
      publication: "State Gazette No. 11 of 2 February 2018",
      populationContext: "Bulgaria",
      referenceAnthropometrySurveyYear: 2014,
    },
    scope: {
      kind: "population_group_average",
      personalized: false,
      normalWeightReference: true,
    },
  };
}
