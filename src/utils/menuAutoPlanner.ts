import { PantryItem, Recipe, MealPlanDay, UserProfile } from "../types";
import { SAMPLE_RECIPES, INITIAL_RECIPES } from "../data/initialData";
import { assessTotalAvailability, areUnitsCompatible } from "./quantityUnits";
import { areReviewedBulgarianFoodAliases } from "./bulgarianFoodAliases";

const normalizeIngredientName = (value: string): string =>
  (value || "").trim().toLowerCase();

const singularStem = (value: string): string => value.replace(/s$/, "");

/**
 * Keeps the current fuzzy name matching behavior in one place so quantity
 * checks, recipe scoring and later shopping calculations can share it.
 */
export function isPantryNameMatch(ingredientName: string, pantryItem: PantryItem): boolean {
  const target = normalizeIngredientName(ingredientName);
  if (!target) return false;

  const cleanTarget = singularStem(target);
  const pName = normalizeIngredientName(pantryItem.name);
  const pNameBg = normalizeIngredientName(pantryItem.nameBg || "");
  const pNameEs = normalizeIngredientName(pantryItem.nameEs || "");
  const cleanPName = singularStem(pName);
  const cleanPNameEs = singularStem(pNameEs);

  if (
    areReviewedBulgarianFoodAliases(target, pName) ||
    areReviewedBulgarianFoodAliases(target, pNameBg) ||
    areReviewedBulgarianFoodAliases(target, pNameEs) ||
    pName.includes(target) ||
    target.includes(pName) ||
    cleanPName.includes(cleanTarget) ||
    cleanTarget.includes(cleanPName) ||
    (pNameBg && (pNameBg.includes(target) || target.includes(pNameBg))) ||
    (pNameEs &&
      (pNameEs.includes(target) ||
        target.includes(pNameEs) ||
        cleanPNameEs.includes(cleanTarget) ||
        cleanTarget.includes(cleanPNameEs)))
  ) {
    return true;
  }

  const targetWords = target
    .split(/\s+/)
    .map(singularStem)
    .filter((word) => word.length > 2);
  const pantryWords = pName
    .split(/\s+/)
    .map(singularStem)
    .filter((word) => word.length > 2);

  return targetWords.some((targetWord) =>
    pantryWords.some(
      (pantryWord) =>
        targetWord.includes(pantryWord) || pantryWord.includes(targetWord)
    )
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
  pantry: PantryItem[]
): boolean {
  const matchingItems = findMatchingPantryItems(ingredientName, pantry);
  if (matchingItems.length === 0) return false;

  const availability = assessTotalAvailability(
    matchingItems.map((item) => ({ quantity: item.quantity, unit: item.unit })),
    requiredAmount,
    requiredUnit
  );

  return availability.status === "enough";
}

/**
 * Returns an updated list of recipes where each ingredient's `inPantry` flag
 * means the pantry has enough compatible quantity, not just a name match.
 */
export function syncRecipesWithPantry(recipes: Recipe[], pantry: PantryItem[]): Recipe[] {
  const pool = recipes.length > 0 ? recipes : [...INITIAL_RECIPES, ...SAMPLE_RECIPES];

  return pool.map((recipe) => {
    const updatedIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      inPantry: isIngredientQuantityAvailable(
        ing.name,
        ing.amount,
        ing.unit,
        pantry
      ),
    }));

    return {
      ...recipe,
      ingredients: updatedIngredients,
    };
  });
}

/**
 * Calculates a match score for a recipe given the pantry inventory.
 * Factors:
 * 1. % of ingredients with sufficient compatible quantity (0 - 100)
 * 2. Perishable bonus: gives extra points if a quantitatively covered
 *    ingredient uses compatible pantry stock expiring soon (expiryDaysLeft <= 5)
 */
export function calculateRecipePantryScore(recipe: Recipe, pantry: PantryItem[]): {
  matchPercentage: number;
  perishableUsedCount: number;
  totalScore: number;
} {
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return { matchPercentage: 0, perishableUsedCount: 0, totalScore: 0 };
  }

  let inCount = 0;
  let perishableBonus = 0;

  recipe.ingredients.forEach((ing) => {
    const matchingItems = findMatchingPantryItems(ing.name, pantry);
    const inPantry = isIngredientQuantityAvailable(
      ing.name,
      ing.amount,
      ing.unit,
      pantry
    );

    if (inPantry) {
      inCount++;

      const expiringCompatibleItem = matchingItems.find(
        (item) =>
          areUnitsCompatible(item.unit, ing.unit) &&
          item.expiryDaysLeft !== undefined &&
          item.expiryDaysLeft <= 5
      );

      if (expiringCompatibleItem) {
        perishableBonus += 25;
      }
    }
  });

  const matchPercentage = Math.round((inCount / recipe.ingredients.length) * 100);
  const totalScore = matchPercentage + perishableBonus;

  return {
    matchPercentage,
    perishableUsedCount: perishableBonus > 0 ? Math.floor(perishableBonus / 25) : 0,
    totalScore,
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
  profile?: UserProfile
): {
  newPlan: MealPlanDay[];
  readyToCookMealsCount: number;
  perishableSavedCount: number;
} {
  const syncedRecipes = syncRecipesWithPantry(recipes, pantry);

  const scoredRecipes = syncedRecipes.map((recipe) => {
    const scoreData = calculateRecipePantryScore(recipe, pantry);
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

  const today = new Date();
  const newPlan: MealPlanDay[] = [];
  let readyToCookMealsCount = 0;
  let perishableSavedCount = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() + dayOffset);
    const dateStr = dateObj.toISOString().split("T")[0];

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
