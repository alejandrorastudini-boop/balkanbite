import type {
  HealthDataStatus,
  HealthDatum,
  HealthProfile,
} from "../types";
import {
  getKnownHealthNumber,
  getKnownHealthValue,
  sanitizeHealthProfile,
} from "./healthProfile";

export type AdultEnergyCollectionField =
  | "ageYears"
  | "heightCm"
  | "weightKg"
  | "physiologicalSex"
  | "activityCategory"
  | "pregnancyLactationStatus";

export type AdultEnergyUnavailableField = {
  field: AdultEnergyCollectionField;
  status: Extract<HealthDataStatus, "not_applicable" | "prefer_not_to_say">;
};

export const ADULT_MAINTENANCE_ENERGY_PURPOSE = {
  id: "adult_maintenance_energy_estimate_v1",
  purpose: "estimate_adult_daily_maintenance_energy",
  outputNature: "estimate_not_prescription",
  persistentInputs: true,
  persistentDerivedEstimate: false,
} as const;

type PlanBase = {
  purpose: typeof ADULT_MAINTENANCE_ENERGY_PURPOSE;
  fieldsToRequest: AdultEnergyCollectionField[];
  unavailableFields: AdultEnergyUnavailableField[];
};

export type AdultEnergyCollectionPlan =
  | (PlanBase & { status: "ready" })
  | (PlanBase & { status: "needs_input" })
  | (PlanBase & { status: "unavailable_by_choice_or_scope" })
  | (PlanBase & {
      status: "unsupported";
      reason:
        | "age_under_19"
        | "pregnancy_or_lactation_requires_specialized_path";
    });

const coreFields: AdultEnergyCollectionField[] = [
  "ageYears",
  "heightCm",
  "weightKg",
  "physiologicalSex",
  "activityCategory",
];

function statusOf(
  datum: HealthDatum<unknown> | undefined,
): HealthDataStatus | undefined {
  return datum?.status;
}

function classifyMissingOrUnavailable(
  field: AdultEnergyCollectionField,
  datum: HealthDatum<unknown> | undefined,
  fieldsToRequest: AdultEnergyCollectionField[],
  unavailableFields: AdultEnergyUnavailableField[],
): void {
  const status = statusOf(datum);

  if (status === "prefer_not_to_say" || status === "not_applicable") {
    unavailableFields.push({ field, status });
    return;
  }

  if (status !== "known") {
    fieldsToRequest.push(field);
  }
}

/**
 * Plans the minimum profile data needed for BalkanBite's current EFSA-based
 * adult maintenance-energy estimate.
 *
 * This is deliberately a collection plan, not a consent record and not a
 * calculation. It exists so future UI can use progressive disclosure and data
 * minimisation:
 * - no defaults;
 * - no automatic PAL classification;
 * - pregnancy/lactation is requested only for the female equation;
 * - if a required field is explicitly declined/not-applicable, the plan stops
 *   instead of collecting other sensitive data that cannot unlock the estimate;
 * - known unsupported states stop collection early.
 */
export function planAdultMaintenanceEnergyCollection(
  profile: HealthProfile | undefined,
): AdultEnergyCollectionPlan {
  const safe = sanitizeHealthProfile(profile);

  const ageYears = getKnownHealthNumber(safe?.ageYears);
  if (ageYears !== undefined && ageYears < 19) {
    return {
      status: "unsupported",
      reason: "age_under_19",
      purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
      fieldsToRequest: [],
      unavailableFields: [],
    };
  }

  const physiologicalSex = getKnownHealthValue(safe?.physiologicalSex);
  const pregnancyLactationStatus = getKnownHealthValue(
    safe?.pregnancyLactationStatus,
  );

  if (
    physiologicalSex === "female" &&
    pregnancyLactationStatus === "pregnant_or_lactating"
  ) {
    return {
      status: "unsupported",
      reason: "pregnancy_or_lactation_requires_specialized_path",
      purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
      fieldsToRequest: [],
      unavailableFields: [],
    };
  }

  const fieldsToRequest: AdultEnergyCollectionField[] = [];
  const unavailableFields: AdultEnergyUnavailableField[] = [];

  const datums: Record<
    Exclude<AdultEnergyCollectionField, "pregnancyLactationStatus">,
    HealthDatum<unknown> | undefined
  > = {
    ageYears: safe?.ageYears,
    heightCm: safe?.heightCm,
    weightKg: safe?.weightKg,
    physiologicalSex: safe?.physiologicalSex,
    activityCategory: safe?.activityCategory,
  };

  for (const field of coreFields) {
    if (field === "pregnancyLactationStatus") continue;
    classifyMissingOrUnavailable(
      field,
      datums[field],
      fieldsToRequest,
      unavailableFields,
    );
  }

  if (unavailableFields.length > 0) {
    return {
      status: "unavailable_by_choice_or_scope",
      purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
      fieldsToRequest: [],
      unavailableFields,
    };
  }

  // Progressive disclosure: do not ask pregnancy/lactation until the
  // physiological equation is explicitly known to be the female equation.
  if (physiologicalSex === "female") {
    classifyMissingOrUnavailable(
      "pregnancyLactationStatus",
      safe?.pregnancyLactationStatus,
      fieldsToRequest,
      unavailableFields,
    );

    if (unavailableFields.length > 0) {
      return {
        status: "unavailable_by_choice_or_scope",
        purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
        fieldsToRequest: [],
        unavailableFields,
      };
    }
  }

  return {
    status: fieldsToRequest.length > 0 ? "needs_input" : "ready",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest,
    unavailableFields: [],
  };
}
