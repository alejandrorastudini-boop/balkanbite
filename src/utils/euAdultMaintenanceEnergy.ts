import type {
  PhysiologicalSexForEnergy,
  PregnancyLactationStatus,
} from "../types";

import {
  getEfsaPalForAdultActivityCategory,
  parseAdultPhysicalActivityCategory,
  type AdultPhysicalActivityCategory,
} from "./adultPhysicalActivity";

export type EfsaAdultEnergySex = PhysiologicalSexForEnergy;

export type EfsaAdultPhysicalActivityCategory = AdultPhysicalActivityCategory;

export type EfsaPregnancyLactationStatus = PregnancyLactationStatus;

export type EfsaAdultEnergyField =
  | "ageYears"
  | "heightCm"
  | "weightKg"
  | "physiologicalSex"
  | "activityCategory"
  | "pregnancyLactationStatus";

export interface EfsaAdultMaintenanceEnergyInput {
  ageYears?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  physiologicalSex?: unknown;
  activityCategory?: unknown;
  /**
   * Required for the female equation so pregnancy/lactation is never silently
   * interpreted as absent.
   */
  pregnancyLactationStatus?: unknown;
}

export interface EfsaAdultMaintenanceEnergyEstimate {
  status: "calculated";
  restingEnergyKcalPerDay: number;
  physicalActivityLevel: 1.4 | 1.6 | 1.8 | 2.0;
  estimatedKcalPerDay: number;
  formulaVersion: "efsa_2013_henry_2005_adult_v1";
  source: {
    organization: "European Food Safety Authority";
    report: "Scientific Opinion on Dietary Reference Values for energy";
    year: 2013;
    doi: "10.2903/j.efsa.2013.3005";
    populationContext: "Europe";
    restingEnergyEquation: "Henry 2005";
  };
  uncertainty: {
    quantified: false;
    factors: ["resting_energy_prediction", "physical_activity_level_selection"];
  };
}

export interface EfsaAdultEnergyInsufficientData {
  status: "insufficient_data";
  missing: EfsaAdultEnergyField[];
}

export interface EfsaAdultEnergyInvalidInput {
  status: "invalid_input";
  invalid: EfsaAdultEnergyField[];
}

export interface EfsaAdultEnergyUnsupported {
  status: "unsupported";
  reason:
    | "age_under_19"
    | "pregnancy_or_lactation_requires_specialized_path";
}

export type EfsaAdultMaintenanceEnergyResult =
  | EfsaAdultMaintenanceEnergyEstimate
  | EfsaAdultEnergyInsufficientData
  | EfsaAdultEnergyInvalidInput
  | EfsaAdultEnergyUnsupported;

type HenryCoefficients = {
  weightKg: number;
  heightM: number;
  intercept: number;
};

const HENRY_2005: Record<
  EfsaAdultEnergySex,
  {
    "19_to_29": HenryCoefficients;
    "30_to_59": HenryCoefficients;
    "60_plus": HenryCoefficients;
  }
> = {
  male: {
    "19_to_29": { weightKg: 14.4, heightM: 313, intercept: 113 },
    "30_to_59": { weightKg: 11.4, heightM: 541, intercept: -137 },
    "60_plus": { weightKg: 11.4, heightM: 541, intercept: -256 },
  },
  female: {
    "19_to_29": { weightKg: 10.4, heightM: 615, intercept: -282 },
    "30_to_59": { weightKg: 8.18, heightM: 502, intercept: -11.6 },
    "60_plus": { weightKg: 8.52, heightM: 421, intercept: 10.7 },
  },
};

function henryAgeBand(ageYears: number): "19_to_29" | "30_to_59" | "60_plus" {
  if (ageYears < 30) return "19_to_29";
  if (ageYears < 60) return "30_to_59";
  return "60_plus";
}

/**
 * Source-based implementation of the EFSA 2013 adult factorial method:
 * predicted REE using Henry (2005), multiplied by PAL 1.4/1.6/1.8/2.0.
 *
 * Important scope boundary:
 * EFSA's DRVs are population reference values and EFSA states they should not
 * be viewed as individual recommendations. This primitive therefore returns an
 * estimate, not a calorie prescription or target.
 *
 * Pregnancy/lactation is deliberately blocked here and belongs in a separate
 * higher-risk module with the specific EFSA/national adjustments.
 */
export function estimateAdultMaintenanceEnergyEfsa2013(
  input: EfsaAdultMaintenanceEnergyInput,
): EfsaAdultMaintenanceEnergyResult {
  const missing: EfsaAdultEnergyField[] = [];
  const invalid: EfsaAdultEnergyField[] = [];

  const readPositiveNumber = (
    field: "ageYears" | "heightCm" | "weightKg",
  ): number | undefined => {
    const value = input[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
      return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      invalid.push(field);
      return undefined;
    }
    return value;
  };

  const ageYears = readPositiveNumber("ageYears");
  const heightCm = readPositiveNumber("heightCm");
  const weightKg = readPositiveNumber("weightKg");

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

  const activityCategory = parseAdultPhysicalActivityCategory(
    input.activityCategory,
  );
  if (
    input.activityCategory === undefined ||
    input.activityCategory === null ||
    input.activityCategory === ""
  ) {
    missing.push("activityCategory");
  } else if (!activityCategory) {
    invalid.push("activityCategory");
  }

  if (physiologicalSex === "female") {
    if (
      input.pregnancyLactationStatus === undefined ||
      input.pregnancyLactationStatus === null ||
      input.pregnancyLactationStatus === ""
    ) {
      missing.push("pregnancyLactationStatus");
    } else if (
      input.pregnancyLactationStatus !== "not_pregnant_or_lactating" &&
      input.pregnancyLactationStatus !== "pregnant_or_lactating"
    ) {
      invalid.push("pregnancyLactationStatus");
    }
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

  if (
    physiologicalSex === "female" &&
    input.pregnancyLactationStatus === "pregnant_or_lactating"
  ) {
    return {
      status: "unsupported",
      reason: "pregnancy_or_lactation_requires_specialized_path",
    };
  }

  const coefficients =
    HENRY_2005[physiologicalSex!][henryAgeBand(ageYears!)];
  const heightM = heightCm! / 100;
  const restingEnergyKcalPerDay =
    coefficients.weightKg * weightKg! +
    coefficients.heightM * heightM +
    coefficients.intercept;
  const physicalActivityLevel =
    getEfsaPalForAdultActivityCategory(activityCategory!);
  const estimatedKcalPerDay =
    restingEnergyKcalPerDay * physicalActivityLevel;

  if (
    !Number.isFinite(restingEnergyKcalPerDay) ||
    !Number.isFinite(estimatedKcalPerDay) ||
    restingEnergyKcalPerDay <= 0 ||
    estimatedKcalPerDay <= 0
  ) {
    return {
      status: "invalid_input",
      invalid: ["ageYears", "heightCm", "weightKg"],
    };
  }

  return {
    status: "calculated",
    restingEnergyKcalPerDay: Math.round(restingEnergyKcalPerDay),
    physicalActivityLevel,
    estimatedKcalPerDay: Math.round(estimatedKcalPerDay),
    formulaVersion: "efsa_2013_henry_2005_adult_v1",
    source: {
      organization: "European Food Safety Authority",
      report: "Scientific Opinion on Dietary Reference Values for energy",
      year: 2013,
      doi: "10.2903/j.efsa.2013.3005",
      populationContext: "Europe",
      restingEnergyEquation: "Henry 2005",
    },
    uncertainty: {
      quantified: false,
      factors: [
        "resting_energy_prediction",
        "physical_activity_level_selection",
      ],
    },
  };
}
