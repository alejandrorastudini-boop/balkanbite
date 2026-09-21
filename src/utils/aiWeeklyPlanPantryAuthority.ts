import { hasValidPantryAcquisitionRequiredFields } from "./pantryAcquisitionValidation";

export interface WeeklyPlanRecipePromptIngredient {
  name: unknown;
  amount: unknown;
  unit: unknown;
}

export interface WeeklyPlanRecipePromptContext {
  id: unknown;
  title: unknown;
  tags: unknown;
  calories: unknown;
  ingredients: WeeklyPlanRecipePromptIngredient[];
}

export interface PantryAvailabilityRecord {
  name: string;
  quantity: number;
  unit: string;
  nameBg?: string;
  nameEs?: string;
}

/**
 * Weekly-plan recipe context intentionally excludes RecipeIngredient.inPantry.
 * Pantry availability is derived state and the request pantry is the only
 * inventory authority that should be supplied to the model.
 */
export function buildWeeklyPlanRecipePromptContext(
  recipes: unknown,
): WeeklyPlanRecipePromptContext[] {
  if (!Array.isArray(recipes)) return [];

  return recipes.flatMap((recipe) => {
    if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) return [];
    const record = recipe as Record<string, unknown>;
    const ingredients = Array.isArray(record.ingredients)
      ? record.ingredients.flatMap((ingredient) => {
          if (!ingredient || typeof ingredient !== "object" || Array.isArray(ingredient)) {
            return [];
          }
          const row = ingredient as Record<string, unknown>;
          return [{
            name: row.name,
            amount: row.amount,
            unit: row.unit,
          }];
        })
      : [];

    return [{
      id: record.id,
      title: record.title,
      tags: record.tags,
      calories: record.calories,
      ingredients,
    }];
  });
}

/**
 * Keep only the fields used by deterministic pantry-availability matching.
 * Malformed rows are ignored rather than becoming availability evidence.
 */
export function buildWeeklyPlanAvailabilityPantry(
  pantry: unknown,
): PantryAvailabilityRecord[] {
  if (!Array.isArray(pantry)) return [];

  return pantry.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (!hasValidPantryAcquisitionRequiredFields(record)) return [];

    return [{
      name: (record.name as string).trim(),
      quantity: record.quantity as number,
      unit: (record.unit as string).trim(),
      ...(typeof record.nameBg === "string" && record.nameBg.trim()
        ? { nameBg: record.nameBg.trim() }
        : {}),
      ...(typeof record.nameEs === "string" && record.nameEs.trim()
        ? { nameEs: record.nameEs.trim() }
        : {}),
    }];
  });
}
