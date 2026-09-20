export const markAiGeneratedRecipePlanningEstimates = <T extends object>(
  recipe: T,
): T & {
  healthScore: undefined;
  nutritionDataStatus: "estimated";
  costDataStatus: "estimated";
} => ({
  ...recipe,
  // Numeric nutrition and cost values produced by an LLM are planning
  // estimates. They are never upgraded to verified merely because the model
  // supplied a number or a provenance-looking field.
  healthScore: undefined,
  nutritionDataStatus: "estimated",
  costDataStatus: "estimated",
});
