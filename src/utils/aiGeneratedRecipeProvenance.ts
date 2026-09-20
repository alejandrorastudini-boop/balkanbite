export type AiGeneratedRecipePlanningEstimate<T extends object> =
  Omit<T, "healthScore" | "nutritionDataStatus" | "costDataStatus"> & {
    healthScore: undefined;
    nutritionDataStatus: "estimated";
    costDataStatus: "estimated";
  };

export const markAiGeneratedRecipePlanningEstimates = <T extends object>(
  recipe: T,
): AiGeneratedRecipePlanningEstimate<T> =>
  ({
    ...recipe,
    // Numeric nutrition and cost values produced by an LLM are planning
    // estimates. They are never upgraded to verified merely because the model
    // supplied a number or a provenance-looking field.
    healthScore: undefined,
    nutritionDataStatus: "estimated",
    costDataStatus: "estimated",
  }) as AiGeneratedRecipePlanningEstimate<T>;
