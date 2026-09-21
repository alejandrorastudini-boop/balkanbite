export interface AiRecipeProvenanceResult {
  [key: string]: unknown;
  nutritionDataStatus: "estimated";
  costDataStatus: "estimated";
}

/**
 * Canonical boundary for recipes produced by an LLM.
 *
 * Model-generated nutrition and price fields are planning estimates only.
 * Arbitrary health scores or claims of verified provenance are discarded.
 */
export function applyAiRecipeEstimateProvenance(
  recipe: unknown,
): AiRecipeProvenanceResult | null {
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    return null;
  }

  const {
    healthScore: _discardedHealthScore,
    nutritionDataStatus: _discardedNutritionStatus,
    costDataStatus: _discardedCostStatus,
    ...rest
  } = recipe as Record<string, unknown>;

  return {
    ...rest,
    nutritionDataStatus: "estimated",
    costDataStatus: "estimated",
  };
}
