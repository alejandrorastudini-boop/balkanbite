type CookingSpeed = "fast" | "moderate" | "elaborate";
type DietStyle =
  | "all"
  | "mediterranean"
  | "vegetarian"
  | "vegan"
  | "keto"
  | "gluten_free";

export interface AiCulinaryProfileContext {
  cookingSpeed?: CookingSpeed;
  dietStyle?: DietStyle;
  disliked?: string[];
  allergies?: string[];
  householdSize?: number;
  appliances?: string[];
  monthlyBudgetEUR?: number;
}

const COOKING_SPEEDS = new Set<CookingSpeed>([
  "fast",
  "moderate",
  "elaborate",
]);

const DIET_STYLES = new Set<DietStyle>([
  "all",
  "mediterranean",
  "vegetarian",
  "vegan",
  "keto",
  "gluten_free",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T | undefined {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

function optionalPositiveFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  const numeric = optionalPositiveFinite(value);
  return numeric !== undefined && Number.isInteger(numeric)
    ? numeric
    : undefined;
}

function optionalStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const strings = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return strings.length > 0 ? strings : undefined;
}

/**
 * Generic culinary AI is intentionally isolated from health/clinical profile
 * data. Only allowlisted cooking and household preferences cross this boundary.
 *
 * In particular, this function must not forward:
 * - healthGoal;
 * - healthProfile or physiological inputs;
 * - subscription/account state;
 * - future conditions, medications, labs or clinical data.
 */
export function buildAiCulinaryProfileContext(
  value: unknown,
): AiCulinaryProfileContext {
  if (!isRecord(value)) return {};

  const cookingSpeed = optionalEnum(value.cookingSpeed, COOKING_SPEEDS);
  const dietStyle = optionalEnum(value.dietStyle, DIET_STYLES);
  const disliked = optionalStringList(value.disliked);
  const allergies = optionalStringList(value.allergies);
  const householdSize = optionalPositiveInteger(value.householdSize);
  const appliances = optionalStringList(value.appliances);
  const monthlyBudgetEUR = optionalPositiveFinite(value.monthlyBudgetEUR);

  return {
    ...(cookingSpeed ? { cookingSpeed } : {}),
    ...(dietStyle ? { dietStyle } : {}),
    ...(disliked ? { disliked } : {}),
    ...(allergies ? { allergies } : {}),
    ...(householdSize !== undefined ? { householdSize } : {}),
    ...(appliances ? { appliances } : {}),
    ...(monthlyBudgetEUR !== undefined ? { monthlyBudgetEUR } : {}),
  };
}
