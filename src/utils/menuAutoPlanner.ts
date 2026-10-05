import { PantryItem, Recipe, MealPlanDay, UserProfile } from "../types";
import { assessTotalAvailability, areUnitsCompatible, normalizeQuantity } from "./quantityUnits";
import { areReviewedBulgarianFoodAliases } from "./bulgarianFoodAliases";
import {
  derivePantryItemExpiry,
  localCalendarDate,
  pantryItemNeedsExpiryReview,
} from "./effectiveExpiry";

const normalizeIngredientName = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularStem = (value: string): string => value.replace(/s$/, "");

const ingredientTokens = (value: string): string[] =>
  normalizeIngredientName(value)
    .split(/\s+/)
    .map(singularStem)
    .filter((word) => word.length > 2);

function hasWholeTokenRequirementMatch(target: string, candidate: string): boolean {
  const requiredTokens = ingredientTokens(target);
  const candidateTokens = new Set(ingredientTokens(candidate));
  return (
    requiredTokens.length > 0 &&
    requiredTokens.every((token) => candidateTokens.has(token))
  );
}

/**
 * Matches pantry names conservatively. Character-substring matching is unsafe
 * for food identity ("egg" must not match "eggplant", "oil" must not match
 * "boiled"). A requirement can match an exact/localized name, a reviewed
 * Bulgarian alias, or complete requirement tokens present in the pantry name.
 */
export function isPantryNameMatch(ingredientName: string, pantryItem: PantryItem): boolean {
  const target = normalizeIngredientName(ingredientName);
  if (!target) return false;

  const candidates = [
    normalizeIngredientName(pantryItem.name),
    normalizeIngredientName(pantryItem.nameBg || ""),
    normalizeIngredientName(pantryItem.nameEs || ""),
  ].filter(Boolean);

  return candidates.some((candidate) => {
    if (areReviewedBulgarianFoodAliases(target, candidate)) return true;
    if (target === candidate) return true;
    if (singularStem(target) === singularStem(candidate)) return true;
    return hasWholeTokenRequirementMatch(target, candidate);
  });
}

export function isAuthoritativePantryNameMatch(
  ingredientName: string,
  pantryItem: PantryItem,
): boolean {
  const target = normalizeIngredientName(ingredientName);
  if (!target) return false;
  const candidates = [
    normalizeIngredientName(pantryItem.name),
    normalizeIngredientName(pantryItem.nameBg || ""),
    normalizeIngredientName(pantryItem.nameEs || ""),
  ].filter(Boolean);

  return candidates.some(
    (candidate) =>
      target === candidate ||
      areReviewedBulgarianFoodAliases(target, candidate),
  );
}

export function findAuthoritativePantryItems(
  ingredientName: string,
  pantry: PantryItem[],
): PantryItem[] {
  if (!pantry || pantry.length === 0) return [];
  return pantry.filter(
    (item) =>
      item.quantity > 0 &&
      isAuthoritativePantryNameMatch(ingredientName, item),
  );
}

export function findMatchingPantryItems(
  ingredientName: string,
  pantry: PantryItem[]
): PantryItem[] {
  if (!pantry || pantry.length === 0) return [];
  return pantry.filter(
    (item) => item.quantity > 0 && isPantryNameMatch(ingredientName, item)
  );
}

/**
 * Legacy presence-only helper retained for callers that do not yet provide a
 * required amount/unit. It answers only whether a positive-quantity name match
 * exists and must not be used to claim quantitative recipe coverage.
 */
export function isIngredientInPantry(
  ingredientName: string,
  pantry: PantryItem[]
): boolean {
  return findMatchingPantryItems(ingredientName, pantry).length > 0;
}

/**
 * Returns true only when matching pantry stock can deterministically cover the
 * required amount in a compatible unit. Unknown container sizes are not guessed.
 */
export function isIngredientQuantityAvailable(
  ingredientName: string,
  requiredAmount: number,
  requiredUnit: string,
  pantry: PantryItem[],
  now: Date = new Date(),
): boolean {
  const matchingItems = findAuthoritativePantryItems(ingredientName, pantry).filter(
    (item) => !pantryItemNeedsExpiryReview(item, now),
  );
  if (matchingItems.length === 0) return false;

  const availability = assessTotalAvailability(
    matchingItems.map((item) => ({ quantity: item.quantity, unit: item.unit })),
    requiredAmount,
    requiredUnit
  );

  return availability.status === "enough";
}

function reserveIngredientFromPantry(
  ingredient: Recipe["ingredients"][number],
  pantry: PantryItem[],
  remainingBaseByPantryId: Map<string, number>,
  now: Date,
): { covered: boolean; usedItemIds: string[] } {
  const required = normalizeQuantity(ingredient.amount, ingredient.unit);
  if (!required || required.baseQuantity <= 0) return { covered: false, usedItemIds: [] };

  const candidates = findAuthoritativePantryItems(ingredient.name, pantry)
    .filter((item) => !pantryItemNeedsExpiryReview(item, now))
    .flatMap((item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      if (!normalized || normalized.unit.dimension !== required.unit.dimension) {
        return [];
      }
      const remaining = remainingBaseByPantryId.has(item.id)
        ? remainingBaseByPantryId.get(item.id) || 0
        : normalized.baseQuantity;
      return [{ item, normalized, remaining }];
    });

  const availableBase = candidates.reduce((sum, candidate) => sum + candidate.remaining, 0);
  if (availableBase + 1e-9 < required.baseQuantity) return { covered: false, usedItemIds: [] };

  let neededBase = required.baseQuantity;
  const usedItemIds: string[] = [];
  for (const candidate of candidates) {
    if (neededBase <= 1e-9) break;
    const used = Math.min(candidate.remaining, neededBase);
    remainingBaseByPantryId.set(candidate.item.id, candidate.remaining - used);
    if (used > 1e-9) usedItemIds.push(candidate.item.id);
    neededBase -= used;
  }
  return { covered: true, usedItemIds };
}

export function syncRecipeWithPantry(
  recipe: Recipe,
  pantry: PantryItem[],
  now: Date = new Date(),
): Recipe {
  const remainingBaseByPantryId = new Map<string, number>();
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      inPantry: reserveIngredientFromPantry(
        ingredient,
        pantry,
        remainingBaseByPantryId,
        now,
      ).covered,
    })),
  };
}

/**
 * Returns an updated list of recipes where each ingredient's `inPantry` flag
 * means the pantry has enough compatible quantity, not just a name match.
 */
export function syncRecipesWithPantry(
  recipes: Recipe[],
  pantry: PantryItem[],
  now: Date = new Date(),
): Recipe[] {
  return recipes.map((recipe) => syncRecipeWithPantry(recipe, pantry, now));
}

/**
 * Calculates a match score for a recipe given the pantry inventory.
 * Factors:
 * 1. % of ingredients with sufficient compatible quantity (0 - 100)
 * 2. Perishable bonus: gives extra points if a quantitatively covered
 *    ingredient uses compatible pantry stock expiring soon (expiryDaysLeft <= 5)
 */
export function calculateRecipePantryScore(
  recipe: Recipe,
  pantry: PantryItem[],
  now: Date = new Date(),
): {
  matchPercentage: number;
  perishableUsedCount: number;
  totalScore: number;
} {
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return { matchPercentage: 0, perishableUsedCount: 0, totalScore: 0 };
  }

  let inCount = 0;
  let perishableBonus = 0;
  const remainingBaseByPantryId = new Map<string, number>();

  recipe.ingredients.forEach((ing) => {
    const reservation = reserveIngredientFromPantry(
      ing,
      pantry,
      remainingBaseByPantryId,
      now,
    );

    if (reservation.covered) {
      inCount++;

      const usedExpiringItem = reservation.usedItemIds.some((id) => {
        const item = pantry.find((candidate) => candidate.id === id);
        if (!item) return false;
        const expiry = derivePantryItemExpiry(item, now);
        return (
          expiry.status === "known" &&
          !expiry.expired &&
          expiry.daysRemaining <= 5
        );
      });

      if (usedExpiringItem) {
        perishableBonus++;
      }
    }
  });

  const matchPercentage = Math.round((inCount / recipe.ingredients.length) * 100);
  const totalScore = matchPercentage + perishableBonus;

  return {
    matchPercentage,
    perishableUsedCount: perishableBonus,
    totalScore,
  };
}

export function syncMealPlanWithPantry(
  existingPlan: MealPlanDay[],
  pantry: PantryItem[],
  now: Date = new Date(),
): {
  newPlan: MealPlanDay[];
  readyToCookMealsCount: number;
  perishableSavedCount: number;
} {
  let readyToCookMealsCount = 0;
  let perishableSavedCount = 0;

  const syncPlannedRecipe = (recipe?: Recipe): Recipe | undefined => {
    if (!recipe) return undefined;

    const [syncedRecipe] = syncRecipesWithPantry([recipe], pantry, now);
    const score = calculateRecipePantryScore(syncedRecipe, pantry, now);

    if (score.matchPercentage === 100) readyToCookMealsCount++;
    perishableSavedCount += score.perishableUsedCount;

    return syncedRecipe;
  };

  const newPlan = existingPlan.map((day) => ({
    ...day,
    ...(day.breakfast
      ? { breakfast: syncPlannedRecipe(day.breakfast) }
      : {}),
    ...(day.lunch ? { lunch: syncPlannedRecipe(day.lunch) } : {}),
    ...(day.dinner ? { dinner: syncPlannedRecipe(day.dinner) } : {}),
  }));

  return {
    newPlan,
    readyToCookMealsCount,
    perishableSavedCount,
  };
}

/**
 * Intelligently adapts or regenerates the 7-day meal plan based on the current pantry inventory.
 * Prioritizes:
 * - Recipes with 100% or highest pantry match.
 * - Recipes utilizing perishable pantry items (anti-waste).
 * - Nutritional variety (breakfast vs lunch/dinner, avoiding back-to-back duplicate recipes).
 */
export function adaptMealPlanToPantry(
  pantry: PantryItem[],
  recipes: Recipe[],
  existingPlan: MealPlanDay[] = [],
  profile?: UserProfile,
  now: Date = new Date(),
): {
  newPlan: MealPlanDay[];
  readyToCookMealsCount: number;
  perishableSavedCount: number;
} {
  const syncedRecipes = syncRecipesWithPantry(recipes, pantry, now);

  if (syncedRecipes.length === 0) {
    return syncMealPlanWithPantry(existingPlan, pantry, now);
  }

  const scoredRecipes = syncedRecipes.map((recipe) => {
    const scoreData = calculateRecipePantryScore(recipe, pantry, now);
    return {
      recipe,
      ...scoreData,
    };
  });

  scoredRecipes.sort((a, b) => b.totalScore - a.totalScore);

  let breakfastPool = scoredRecipes.filter(
    (entry) =>
      entry.recipe.tags.some((tag) =>
        ["breakfast", "desayuno", "quick", "fácil", "smoothie", "rápido"].includes(
          tag.toLowerCase()
        )
      ) &&
      !entry.recipe.tags.some((tag) =>
        [
          "guiso",
          "lentejas",
          "garbanzos",
          "plato principal",
          "fitness",
          "pollo",
          "mediterráneo",
        ].includes(tag.toLowerCase())
      )
  );

  if (breakfastPool.length === 0) {
    breakfastPool = scoredRecipes.filter(
      (entry) =>
        entry.recipe.calories < 400 &&
        !entry.recipe.tags.some((tag) =>
          ["guiso", "lentejas", "garbanzos"].includes(tag.toLowerCase())
        )
    );
  }
  if (breakfastPool.length === 0) {
    breakfastPool = scoredRecipes;
  }

  const mainPool = scoredRecipes.filter(
    (entry) =>
      !entry.recipe.tags.some((tag) =>
        ["breakfast", "desayuno"].includes(tag.toLowerCase())
      )
  );

  const fallbackPool = scoredRecipes;

  const today = new Date(now);
  const newPlan: MealPlanDay[] = [];
  let readyToCookMealsCount = 0;
  let perishableSavedCount = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() + dayOffset);
    const dateStr = localCalendarDate(dateObj);
    if (!dateStr) continue;

    const breakfastIndex = dayOffset % (breakfastPool.length || 1);
    const breakfastEntry =
      breakfastPool[breakfastIndex] ||
      fallbackPool[dayOffset % fallbackPool.length];

    const lunchDinnerPool = mainPool.length > 0 ? mainPool : fallbackPool;
    const lunchIndex = (dayOffset * 2) % lunchDinnerPool.length;
    const lunchEntry =
      lunchDinnerPool[lunchIndex] ||
      fallbackPool[(dayOffset + 1) % fallbackPool.length];

    const dinnerIndex = (dayOffset * 2 + 1) % lunchDinnerPool.length;
    const dinnerEntry =
      lunchDinnerPool[dinnerIndex] ||
      fallbackPool[(dayOffset + 2) % fallbackPool.length];

    if (breakfastEntry?.matchPercentage === 100) readyToCookMealsCount++;
    if (lunchEntry?.matchPercentage === 100) readyToCookMealsCount++;
    if (dinnerEntry?.matchPercentage === 100) readyToCookMealsCount++;

    perishableSavedCount +=
      (breakfastEntry?.perishableUsedCount || 0) +
      (lunchEntry?.perishableUsedCount || 0) +
      (dinnerEntry?.perishableUsedCount || 0);

    newPlan.push({
      date: dateStr,
      breakfast: breakfastEntry?.recipe,
      lunch: lunchEntry?.recipe,
      dinner: dinnerEntry?.recipe,
    });
  }

  return {
    newPlan,
    readyToCookMealsCount,
    perishableSavedCount,
  };
}
