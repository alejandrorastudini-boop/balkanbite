import type { Recipe } from "../types";
import { applyAiRecipeEstimateProvenance } from "./aiRecipeProvenance";
import { validateAiRecipeStructure } from "./aiRecipeValidation";

const VALID_NUTRITION_STATUSES = new Set([
  "verified",
  "estimated",
  "unknown",
]);

const VALID_COST_STATUSES = new Set([
  "verified",
  "estimated",
  "unknown",
]);

function hasValidOptionalStatus(
  value: unknown,
  allowed: ReadonlySet<string>,
): boolean {
  return value === undefined || (typeof value === "string" && allowed.has(value));
}

function hasValidOptionalFiniteNumber(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function hasValidOptionalText(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

/**
 * Structural boundary for recipes read from local or cloud persistence.
 *
 * The AI provenance helper is used only on a temporary copy so the canonical
 * recipe-shape validator can be reused. The stored object itself is returned
 * unchanged: this function must never upgrade/downgrade provenance or invent
 * food, nutrition, cost, translation, instruction, or ingredient data.
 */
export function isStoredRecipeStructurallyValid(
  value: unknown,
): value is Recipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasValidOptionalStatus(
      record.nutritionDataStatus,
      VALID_NUTRITION_STATUSES,
    ) ||
    !hasValidOptionalStatus(record.costDataStatus, VALID_COST_STATUSES) ||
    !hasValidOptionalFiniteNumber(record.healthScore) ||
    !hasValidOptionalText(record.imageUrl)
  ) {
    return false;
  }

  const explicitId =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : "";

  if (!explicitId) return false;

  const structuralProbe = validateAiRecipeStructure(
    applyAiRecipeEstimateProvenance(value),
    explicitId,
  );

  return structuralProbe !== null;
}

/**
 * Parses a persisted recipe array while quarantining malformed rows.
 *
 * - missing cache remains unresolved (null);
 * - malformed top-level JSON/shape remains unresolved (null);
 * - malformed recipe rows are ignored rather than coerced;
 * - valid rows are returned exactly as stored.
 */
export function parseStoredRecipeCache(raw: string | null): Recipe[] | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(isStoredRecipeStructurallyValid);
  } catch {
    return null;
  }
}
