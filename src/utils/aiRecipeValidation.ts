import type { Recipe, RecipeIngredient } from "../types";

const RECIPE_DIFFICULTIES = new Set<Recipe["difficulty"]>([
  "easy",
  "medium",
  "advanced",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function localizedText(value: unknown): Recipe["title"] | null {
  const record = asRecord(value);
  if (!record) return null;

  const en = cleanText(record.en);
  const bg = cleanText(record.bg);
  const es = cleanText(record.es);
  if (!en || !bg || !es) return null;

  return { en, bg, es };
}

function localizedInstructions(value: unknown): Recipe["instructions"] | null {
  const record = asRecord(value);
  if (!record) return null;

  const readSteps = (candidate: unknown): string[] | null => {
    if (!Array.isArray(candidate) || candidate.length === 0) return null;
    const steps = candidate.map(cleanText);
    return steps.every((step): step is string => Boolean(step)) ? steps : null;
  };

  const en = readSteps(record.en);
  const bg = readSteps(record.bg);
  const es = readSteps(record.es);
  if (!en || !bg || !es) return null;

  return { en, bg, es };
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(cleanText);
  return items.every((item): item is string => Boolean(item)) ? items : null;
}

function recipeIngredient(value: unknown): RecipeIngredient | null {
  const record = asRecord(value);
  if (!record) return null;

  const name = cleanText(record.name);
  const amount = finitePositive(record.amount);
  const unit = cleanText(record.unit);

  if (!name || amount === null || !unit || typeof record.inPantry !== "boolean") {
    return null;
  }

  return {
    name,
    amount,
    unit,
    inPantry: record.inPantry,
  };
}

/**
 * Structural gate for AI-generated recipe objects after provenance downgrade.
 *
 * This function never fills in missing food, nutrition, price, translation,
 * instruction, or ingredient data. It only permits a complete, finite recipe
 * shape to cross the API boundary. Internal IDs may use an explicit fallback
 * supplied by the caller because identity is app metadata, not food evidence.
 */
export function validateAiRecipeStructure(
  value: unknown,
  fallbackId?: string,
): Recipe | null {
  const record = asRecord(value);
  if (!record) return null;

  if (
    record.nutritionDataStatus !== "estimated" ||
    record.costDataStatus !== "estimated"
  ) {
    return null;
  }

  const id = cleanText(record.id) ?? cleanText(fallbackId);
  const title = localizedText(record.title);
  const description = localizedText(record.description);
  const prepTimeMin = finiteNonNegative(record.prepTimeMin);
  const cookTimeMin = finiteNonNegative(record.cookTimeMin);
  const costPerServingEUR = finiteNonNegative(record.costPerServingEUR);
  const servings = finitePositive(record.servings);
  const calories = finiteNonNegative(record.calories);
  const proteinG = finiteNonNegative(record.proteinG);
  const carbsG = finiteNonNegative(record.carbsG);
  const fatG = finiteNonNegative(record.fatG);
  const fiberG = finiteNonNegative(record.fiberG);
  const tags = stringArray(record.tags);
  const instructions = localizedInstructions(record.instructions);
  const nutritionHighlights = localizedText(record.nutritionHighlights);

  if (
    !id ||
    !title ||
    !description ||
    prepTimeMin === null ||
    cookTimeMin === null ||
    costPerServingEUR === null ||
    typeof record.difficulty !== "string" ||
    !RECIPE_DIFFICULTIES.has(record.difficulty as Recipe["difficulty"]) ||
    servings === null ||
    calories === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null ||
    fiberG === null ||
    !tags ||
    !instructions ||
    !nutritionHighlights ||
    !Array.isArray(record.ingredients) ||
    record.ingredients.length === 0
  ) {
    return null;
  }

  const ingredients = record.ingredients.map(recipeIngredient);
  if (!ingredients.every((item): item is RecipeIngredient => Boolean(item))) {
    return null;
  }

  const imageUrl = cleanText(record.imageUrl);

  return {
    id,
    title,
    description,
    prepTimeMin,
    cookTimeMin,
    costPerServingEUR,
    difficulty: record.difficulty as Recipe["difficulty"],
    servings,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    nutritionDataStatus: "estimated",
    costDataStatus: "estimated",
    tags,
    ingredients,
    instructions,
    nutritionHighlights,
    ...(imageUrl ? { imageUrl } : {}),
  };
}
