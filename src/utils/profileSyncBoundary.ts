import { DEFAULT_PROFILE } from "../data/initialData";
import type {
  Currency,
  Language,
  UserProfile,
} from "../types";
import {
  cloneHealthProfile,
  sanitizeHealthProfile,
  serializeHealthProfile,
} from "./healthProfile";

const LANGUAGES = new Set<Language>(["es", "en", "bg"]);
const CURRENCIES = new Set<Currency>(["EUR", "USD"]);
const COOKING_SPEEDS = new Set<UserProfile["cookingSpeed"]>([
  "fast",
  "moderate",
  "elaborate",
]);
const HEALTH_GOALS = new Set<UserProfile["healthGoal"]>([
  "balanced",
  "muscle",
  "fat_loss",
  "heart",
]);
const DIET_STYLES = new Set<UserProfile["dietStyle"]>([
  "all",
  "mediterranean",
  "vegetarian",
  "vegan",
  "keto",
  "gluten_free",
]);
const BUDGET_TIERS = new Set<UserProfile["budgetTier"]>([
  "strict_budget",
  "balanced",
  "flexible",
]);
const COOKING_LEVELS = new Set<NonNullable<UserProfile["cookingLevel"]>>([
  "beginner",
  "intermediate",
  "chef",
]);

const cloneStrings = (value: readonly string[] | undefined): string[] | undefined =>
  value ? [...value] : undefined;

function cloneProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    disliked: [...profile.disliked],
    allergies: cloneStrings(profile.allergies),
    appliances: cloneStrings(profile.appliances),
    healthProfile: cloneHealthProfile(profile.healthProfile),
  };
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
  return cleaned;
}

function finitePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 50
    ? value
    : undefined;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function createSignedInProfileDefaults(
  displayName?: string | null,
): UserProfile {
  return {
    ...cloneProfile(DEFAULT_PROFILE),
    name: typeof displayName === "string" ? displayName.trim() : "",
    disliked: [],
    allergies: undefined,
    appliances: undefined,
    householdSize: undefined,
    cookingLevel: undefined,
    monthlyBudgetEUR: undefined,
    healthProfile: undefined,
    isProSubscriber: false,
    onboardingCompleted: false,
  };
}

function sanitizeProfile(
  value: unknown,
  defaults: UserProfile,
): UserProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const profile = cloneProfile(defaults);

  if (typeof raw.name === "string") profile.name = raw.name.trim();
  if (
    typeof raw.language === "string" &&
    LANGUAGES.has(raw.language as Language)
  ) {
    profile.language = raw.language as Language;
  }
  if (
    typeof raw.currency === "string" &&
    CURRENCIES.has(raw.currency as Currency)
  ) {
    profile.currency = raw.currency as Currency;
  }
  if (
    typeof raw.cookingSpeed === "string" &&
    COOKING_SPEEDS.has(raw.cookingSpeed as UserProfile["cookingSpeed"])
  ) {
    profile.cookingSpeed = raw.cookingSpeed as UserProfile["cookingSpeed"];
  }
  if (
    typeof raw.healthGoal === "string" &&
    HEALTH_GOALS.has(raw.healthGoal as UserProfile["healthGoal"])
  ) {
    profile.healthGoal = raw.healthGoal as UserProfile["healthGoal"];
  }
  if (
    typeof raw.dietStyle === "string" &&
    DIET_STYLES.has(raw.dietStyle as UserProfile["dietStyle"])
  ) {
    profile.dietStyle = raw.dietStyle as UserProfile["dietStyle"];
  }

  const disliked = cleanStringArray(raw.disliked);
  if (disliked) profile.disliked = disliked;

  const allergies = cleanStringArray(raw.allergies);
  profile.allergies = allergies;

  const appliances = cleanStringArray(raw.appliances);
  profile.appliances = appliances;

  const householdSize = finitePositiveInteger(raw.householdSize);
  profile.householdSize = householdSize;

  if (
    typeof raw.cookingLevel === "string" &&
    COOKING_LEVELS.has(
      raw.cookingLevel as NonNullable<UserProfile["cookingLevel"]>,
    )
  ) {
    profile.cookingLevel =
      raw.cookingLevel as NonNullable<UserProfile["cookingLevel"]>;
  } else {
    profile.cookingLevel = undefined;
  }

  profile.monthlyBudgetEUR = finiteNonNegative(raw.monthlyBudgetEUR);
  profile.healthProfile = sanitizeHealthProfile(
    raw.healthProfile,
    raw.heightCm,
    raw.weightKg,
  );

  if (
    typeof raw.budgetTier === "string" &&
    BUDGET_TIERS.has(raw.budgetTier as UserProfile["budgetTier"])
  ) {
    profile.budgetTier = raw.budgetTier as UserProfile["budgetTier"];
  }

  if (typeof raw.isProSubscriber === "boolean") {
    profile.isProSubscriber = raw.isProSubscriber;
  }
  if (typeof raw.onboardingCompleted === "boolean") {
    profile.onboardingCompleted = raw.onboardingCompleted;
  }

  return profile;
}

export function serializeUserProfileForFirestore(
  profile: UserProfile,
): Record<string, unknown> {
  const safeProfile =
    sanitizeProfile(profile, createSignedInProfileDefaults()) ??
    createSignedInProfileDefaults();

  return {
    name: safeProfile.name,
    language: safeProfile.language,
    currency: safeProfile.currency,
    cookingSpeed: safeProfile.cookingSpeed,
    healthGoal: safeProfile.healthGoal,
    dietStyle: safeProfile.dietStyle,
    disliked: [...safeProfile.disliked],
    allergies: safeProfile.allergies ? [...safeProfile.allergies] : null,
    householdSize: safeProfile.householdSize ?? null,
    cookingLevel: safeProfile.cookingLevel ?? null,
    appliances: safeProfile.appliances ? [...safeProfile.appliances] : null,
    monthlyBudgetEUR: safeProfile.monthlyBudgetEUR ?? null,
    healthProfile: serializeHealthProfile(safeProfile.healthProfile),
    // Clear legacy flat body metrics on the next successful profile write.
    heightCm: null,
    weightKg: null,
    budgetTier: safeProfile.budgetTier,
    isProSubscriber: safeProfile.isProSubscriber,
    onboardingCompleted: safeProfile.onboardingCompleted,
  };
}

/**
 * Firestore metadata and unknown fields never enter application profile state.
 * Missing fields resolve against signed-in defaults, never another session.
 */
export function sanitizeRemoteUserProfile(value: unknown): UserProfile {
  return (
    sanitizeProfile(value, createSignedInProfileDefaults()) ??
    createSignedInProfileDefaults()
  );
}

export function getUserProfileCacheKey(userId: string): string {
  return `balkanbite_profile_user_${userId}`;
}

export function parseUserProfileCache(
  raw: string | null,
  displayName?: string | null,
): UserProfile | null {
  if (raw === null) return null;
  try {
    return sanitizeProfile(
      JSON.parse(raw),
      createSignedInProfileDefaults(displayName),
    );
  } catch {
    return null;
  }
}

export function parseGuestProfileCache(raw: string | null): UserProfile | null {
  if (raw === null) return null;
  try {
    return sanitizeProfile(JSON.parse(raw), cloneProfile(DEFAULT_PROFILE));
  } catch {
    return null;
  }
}
