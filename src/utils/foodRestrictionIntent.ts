import type { BalkanBiteFoodRestrictionId } from "./foodRestrictions";

export type FoodRestrictionKind = "allergy" | "intolerance";
export type FoodRestrictionUseIntent = "use_once" | "save_to_profile";

export interface ConfirmedFoodRestriction {
  restrictionId: BalkanBiteFoodRestrictionId;
  kind: FoodRestrictionKind;
  confirmedByUser: true;
  confirmedAt: string;
  source: "self_reported";
}

export interface FoodRestrictionIntent {
  version: 1;
  purpose: "food_recommendation_safety_screening_v1";
  useIntent: FoodRestrictionUseIntent;
  restrictions: ConfirmedFoodRestriction[];
}

export type FoodRestrictionIntentValidation =
  | { status: "valid"; value: FoodRestrictionIntent }
  | { status: "invalid"; reason: "invalid_shape" | "invalid_purpose" | "invalid_use_intent" | "invalid_restriction" | "duplicate_restriction" };

const CANONICAL_IDS = new Set<BalkanBiteFoodRestrictionId>([
  "eu_annex_ii:cereals_containing_gluten", "eu_annex_ii:crustaceans",
  "eu_annex_ii:eggs", "eu_annex_ii:fish", "eu_annex_ii:peanuts",
  "eu_annex_ii:soybeans", "eu_annex_ii:milk", "eu_annex_ii:nuts",
  "eu_annex_ii:celery", "eu_annex_ii:mustard", "eu_annex_ii:sesame",
  "eu_annex_ii:sulphur_dioxide_and_sulphites", "eu_annex_ii:lupin",
  "eu_annex_ii:molluscs", "intolerance:lactose",
]);

function isCanonicalRestrictionId(value: unknown): value is BalkanBiteFoodRestrictionId {
  return typeof value === "string" && CANONICAL_IDS.has(value as BalkanBiteFoodRestrictionId);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/**
 * Validates an explicitly confirmed restriction intent.
 *
 * This boundary deliberately does not persist anything. Transient use and
 * save-to-profile remain distinct so a future privacy-reviewed UI cannot
 * silently turn one-time food-safety input into stored health data.
 */
export function validateFoodRestrictionIntent(value: unknown): FoodRestrictionIntentValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "invalid", reason: "invalid_shape" };
  }

  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || raw.purpose !== "food_recommendation_safety_screening_v1") {
    return { status: "invalid", reason: "invalid_purpose" };
  }
  if (raw.useIntent !== "use_once" && raw.useIntent !== "save_to_profile") {
    return { status: "invalid", reason: "invalid_use_intent" };
  }
  if (!Array.isArray(raw.restrictions)) {
    return { status: "invalid", reason: "invalid_shape" };
  }

  const restrictions: ConfirmedFoodRestriction[] = [];
  const seen = new Set<string>();

  for (const entry of raw.restrictions) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { status: "invalid", reason: "invalid_restriction" };
    }
    const item = entry as Record<string, unknown>;
    if (
      !isCanonicalRestrictionId(item.restrictionId) ||
      (item.kind !== "allergy" && item.kind !== "intolerance") ||
      item.confirmedByUser !== true ||
      item.source !== "self_reported" ||
      !isIsoTimestamp(item.confirmedAt)
    ) {
      return { status: "invalid", reason: "invalid_restriction" };
    }

    // Lactose is an intolerance concept in BalkanBite. Annex II milk remains
    // available for an explicitly declared allergy; never infer one from the other.
    if (item.restrictionId === "intolerance:lactose" && item.kind !== "intolerance") {
      return { status: "invalid", reason: "invalid_restriction" };
    }

    const key = String(item.kind) + ":" + item.restrictionId;
    if (seen.has(key)) {
      return { status: "invalid", reason: "duplicate_restriction" };
    }
    seen.add(key);
    restrictions.push({
      restrictionId: item.restrictionId,
      kind: item.kind,
      confirmedByUser: true,
      confirmedAt: item.confirmedAt,
      source: "self_reported",
    });
  }

  return {
    status: "valid",
    value: {
      version: 1,
      purpose: "food_recommendation_safety_screening_v1",
      useIntent: raw.useIntent,
      restrictions,
    },
  };
}

export function getConfirmedRestrictionIds(intent: FoodRestrictionIntent): BalkanBiteFoodRestrictionId[] {
  return intent.restrictions.map((item) => item.restrictionId);
}
