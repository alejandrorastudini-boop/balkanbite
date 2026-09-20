import type { AdultPhysicalActivityCategory as HealthAdultPhysicalActivityCategory } from "../types";

export type AdultPhysicalActivityCategory =
  HealthAdultPhysicalActivityCategory;

export type EfsaAdultPal = 1.4 | 1.6 | 1.8 | 2.0;

export interface ExplicitAdultActivitySelection {
  status: "selected";
  category: AdultPhysicalActivityCategory;
  efsaPal: EfsaAdultPal;
  selectionMethod: "explicit_self_report";
  approximate: true;
  autoClassified: false;
  sourceContext: {
    organization: "European Food Safety Authority";
    report: "Scientific Opinion on Dietary Reference Values for energy";
    year: 2013;
    doi: "10.2903/j.efsa.2013.3005";
  };
}

export interface MissingAdultActivitySelection {
  status: "insufficient_data";
  missing: ["activityCategory"];
}

export interface InvalidAdultActivitySelection {
  status: "invalid_input";
  invalid: ["activityCategory"];
}

export type AdultActivitySelectionResult =
  | ExplicitAdultActivitySelection
  | MissingAdultActivitySelection
  | InvalidAdultActivitySelection;

const EFSA_PAL_BY_ACTIVITY: Record<
  AdultPhysicalActivityCategory,
  EfsaAdultPal
> = {
  low_active: 1.4,
  moderately_active: 1.6,
  active: 1.8,
  very_active: 2.0,
};

export function parseAdultPhysicalActivityCategory(
  value: unknown,
): AdultPhysicalActivityCategory | undefined {
  return value === "low_active" ||
    value === "moderately_active" ||
    value === "active" ||
    value === "very_active"
    ? value
    : undefined;
}

export function getEfsaPalForAdultActivityCategory(
  category: AdultPhysicalActivityCategory,
): EfsaAdultPal {
  return EFSA_PAL_BY_ACTIVITY[category];
}

/**
 * Resolves only an explicit self-reported category.
 *
 * EFSA describes PAL 1.4/1.6/1.8/2.0 as approximate reflections of low-active
 * (sedentary), moderately active, active and very active lifestyles. The PAL
 * category depends on the person's whole-day pattern, including work,
 * exercise and household activity.
 *
 * This utility deliberately does NOT infer or auto-classify a category from
 * sparse questionnaire answers, steps, job title or exercise frequency.
 * Missing activity stays missing.
 */
export function resolveExplicitAdultActivitySelection(
  value: unknown,
): AdultActivitySelectionResult {
  if (value === undefined || value === null || value === "") {
    return {
      status: "insufficient_data",
      missing: ["activityCategory"],
    };
  }

  const category = parseAdultPhysicalActivityCategory(value);
  if (!category) {
    return {
      status: "invalid_input",
      invalid: ["activityCategory"],
    };
  }

  return {
    status: "selected",
    category,
    efsaPal: getEfsaPalForAdultActivityCategory(category),
    selectionMethod: "explicit_self_report",
    approximate: true,
    autoClassified: false,
    sourceContext: {
      organization: "European Food Safety Authority",
      report: "Scientific Opinion on Dietary Reference Values for energy",
      year: 2013,
      doi: "10.2903/j.efsa.2013.3005",
    },
  };
}
