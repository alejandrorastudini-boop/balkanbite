export type PhysiologicalSexForEnergyEquation = "female" | "male";

export type AdultPhysicalActivityCategory =
  | "inactive"
  | "low_active"
  | "active"
  | "very_active";

export type PregnancyLactationStatus =
  | "not_pregnant_or_lactating"
  | "pregnant_or_lactating";

export type AdultEnergyRequirementField =
  | "ageYears"
  | "heightCm"
  | "weightKg"
  | "physiologicalSex"
  | "activityCategory"
  | "pregnancyLactationStatus";

export interface AdultMaintenanceEnergyInput {
  ageYears?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  /**
   * Physiological sex is used only to select the source equation.
   * It is not a gender-identity field.
   */
  physiologicalSex?: unknown;
  activityCategory?: unknown;
  /**
   * Required only for the female adult equation so pregnancy/lactation is
   * never silently treated as absent.
   */
  pregnancyLactationStatus?: unknown;
}

export interface AdultMaintenanceEnergyEstimate {
  status: "calculated";
  estimatedKcalPerDay: number;
  formulaVersion: "nasem_dri_energy_2023_adult_v1";
  source: {
    organization: "National Academies of Sciences, Engineering, and Medicine";
    report: "Dietary Reference Intakes for Energy";
    year: 2023;
    doi: "10.17226/26818";
  };
  modelError: {
    metric: "mean_absolute_error";
    kcalPerDay: number;
  };
}

export interface AdultMaintenanceEnergyInsufficientData {
  status: "insufficient_data";
  missing: AdultEnergyRequirementField[];
}

export interface AdultMaintenanceEnergyInvalidInput {
  status: "invalid_input";
  invalid: AdultEnergyRequirementField[];
}

export interface AdultMaintenanceEnergyUnsupported {
  status: "unsupported";
  reason: "age_under_19" | "pregnancy_or_lactation_requires_specialized_equation";
}

export type AdultMaintenanceEnergyResult =
  | AdultMaintenanceEnergyEstimate
  | AdultMaintenanceEnergyInsufficientData
  | AdultMaintenanceEnergyInvalidInput
  | AdultMaintenanceEnergyUnsupported;

type EquationCoefficients = {
  intercept: number;
  age: number;
  heightCm: number;
  weightKg: number;
};

const EQUATIONS: Record<
  PhysiologicalSexForEnergyEquation,
  Record<AdultPhysicalActivityCategory, EquationCoefficients>
> = {
  male: {
    inactive: { intercept: 753.07, age: -10.83, heightCm: 6.5, weightKg: 14.1 },
    low_active: { intercept: 581.47, age: -10.83, heightCm: 8.3, weightKg: 14.94 },
    active: { intercept: 1004.82, age: -10.83, heightCm: 6.52, weightKg: 15.91 },
    very_active: { intercept: -517.88, age: -10.83, heightCm: 15.61, weightKg: 19.11 },
  },
  female: {
    inactive: { intercept: 584.9, age: -7.01, heightCm: 5.72, weightKg: 11.71 },
    low_active: { intercept: 575.77, age: -7.01, heightCm: 6.6, weightKg: 12.14 },
    active: { intercept: 710.25, age: -7.01, heightCm: 6.54, weightKg: 12.34 },
    very_active: { intercept: 511.83, age: -7.01, heightCm: 9.07, weightKg: 12.56 },
  },
};

/**
 * Source:
 * National Academies of Sciences, Engineering, and Medicine (2023),
 * Dietary Reference Intakes for Energy, DOI 10.17226/26818.
 *
 * Scope:
 * - adults 19 years and older;
 * - maintenance-energy estimate, not a weight-loss/gain prescription;
 * - requires an explicit physical-activity category;
 * - pregnancy/lactation is intentionally not handled by this v1 primitive.
 *
 * The source itself describes individual EER as an estimate and notes that
 * choosing an individual's PAL category is challenging. Callers must not
 * present this result as an exact calorie requirement.
 */
export function estimateAdultMaintenanceEnergy(
  input: AdultMaintenanceEnergyInput,
): AdultMaintenanceEnergyResult {
  const missing: AdultEnergyRequirementField[] = [];
  const invalid: AdultEnergyRequirementField[] = [];

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
  if (input.physiologicalSex === undefined || input.physiologicalSex === null || input.physiologicalSex === "") {
    missing.push("physiologicalSex");
  } else if (!physiologicalSex) {
    invalid.push("physiologicalSex");
  }

  const activityCategory =
    input.activityCategory === "inactive" ||
    input.activityCategory === "low_active" ||
    input.activityCategory === "active" ||
    input.activityCategory === "very_active"
      ? input.activityCategory
      : undefined;
  if (input.activityCategory === undefined || input.activityCategory === null || input.activityCategory === "") {
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
      reason: "pregnancy_or_lactation_requires_specialized_equation",
    };
  }

  const coefficients = EQUATIONS[physiologicalSex!][activityCategory!];
  const estimatedKcalPerDay =
    coefficients.intercept +
    coefficients.age * ageYears! +
    coefficients.heightCm * heightCm! +
    coefficients.weightKg * weightKg!;

  if (!Number.isFinite(estimatedKcalPerDay) || estimatedKcalPerDay <= 0) {
    return {
      status: "invalid_input",
      invalid: ["ageYears", "heightCm", "weightKg"],
    };
  }

  return {
    status: "calculated",
    estimatedKcalPerDay: Math.round(estimatedKcalPerDay),
    formulaVersion: "nasem_dri_energy_2023_adult_v1",
    source: {
      organization: "National Academies of Sciences, Engineering, and Medicine",
      report: "Dietary Reference Intakes for Energy",
      year: 2023,
      doi: "10.17226/26818",
    },
    modelError: {
      metric: "mean_absolute_error",
      kcalPerDay: physiologicalSex === "male" ? 266 : 191,
    },
  };
}
