import { PantryItem, Recipe, MealPlanDay, UserProfile } from "../types";
import { SAMPLE_RECIPES, INITIAL_RECIPES } from "../data/initialData";

/**
 * Checks if a recipe ingredient is satisfied by items in the pantry.
 */
export function isIngredientInPantry(ingredientName: string, pantry: PantryItem[]): boolean {
  if (!pantry || pantry.length === 0) return false;
  const target = ingredientName.trim().toLowerCase();
  const cleanTarget = target.replace(/s$/, ""); // basic singular stem

  return pantry.some((p) => {
    if (p.quantity <= 0) return false;
    const pName = (p.name || "").trim().toLowerCase();
    const pNameBg = (p.nameBg || "").trim().toLowerCase();
    const pNameEs = (p.nameEs || "").trim().toLowerCase();
    const cleanPName = pName.replace(/s$/, "");
    const cleanPNameEs = pNameEs.replace(/s$/, "");

    // Exact or substring match or stem match
    if (
      pName.includes(target) ||
      target.includes(pName) ||
      cleanPName.includes(cleanTarget) ||
      cleanTarget.includes(cleanPName) ||
      (pNameBg && (pNameBg.includes(target) || target.includes(pNameBg))) ||
      (pNameEs && (pNameEs.includes(target) || target.includes(pNameEs) || cleanPNameEs.includes(cleanTarget) || cleanTarget.includes(cleanPNameEs)))
    ) {
      return true;
    }

    // Word-level match for common terms
    const targetWords = target.split(/\s+/).map(w => w.replace(/s$/, "")).filter((w) => w.length > 2);
    const pWords = pName.split(/\s+/).map(w => w.replace(/s$/, "")).filter((w) => w.length > 2);

    return targetWords.some((tw) => pWords.some((pw) => tw.includes(pw) || pw.includes(tw)));
  });
}

/**
 * Returns an updated list of recipes where each ingredient's `inPantry` flag
 * accurately reflects current pantry inventory.
 */
export function syncRecipesWithPantry(recipes: Recipe[], pantry: PantryItem[]): Recipe[] {
  const pool = recipes.length > 0 ? recipes : [...INITIAL_RECIPES, ...SAMPLE_RECIPES];

  return pool.map((recipe) => {
    const updatedIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      inPantry: isIngredientInPantry(ing.name, pantry),
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
 * 1. % of ingredients currently in pantry (0 - 100)
 * 2. Perishable bonus: gives extra points if the recipe uses pantry items expiring soon (expiryDaysLeft <= 5)
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
    const inPantry = isIngredientInPantry(ing.name, pantry);
    if (inPantry) {
      inCount++;

      // Check if this matched item is close to expiring (anti-waste bonus)
      const target = ing.name.toLowerCase();
      const matchedPantryItem = pantry.find((p) => {
        const pName = (p.name || "").toLowerCase();
        return pName.includes(target) || target.includes(pName);
      });

      if (matchedPantryItem && matchedPantryItem.expiryDaysLeft !== undefined && matchedPantryItem.expiryDaysLeft <= 5) {
        perishableBonus += 25; // High priority to prevent food waste
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

  // Score each recipe
  const scoredRecipes = syncedRecipes.map((r) => {
    const scoreData = calculateRecipePantryScore(r, pantry);
    return {
      recipe: r,
      ...scoreData,
    };
  });

  // Sort descending by total score
  scoredRecipes.sort((a, b) => b.totalScore - a.totalScore);

  let breakfastPool = scoredRecipes.filter(
    (sr) =>
      sr.recipe.tags.some((t) => ["breakfast", "desayuno", "quick", "fácil", "smoothie", "rápido"].includes(t.toLowerCase())) &&
      !sr.recipe.tags.some((t) => ["guiso", "lentejas", "garbanzos", "plato principal", "fitness", "pollo", "mediterráneo"].includes(t.toLowerCase()))
  );
  if (breakfastPool.length === 0) {
    breakfastPool = scoredRecipes.filter((sr) => sr.recipe.calories < 400 && !sr.recipe.tags.some((t) => ["guiso", "lentejas", "garbanzos"].includes(t.toLowerCase())));
  }
  if (breakfastPool.length === 0) {
    breakfastPool = scoredRecipes;
  }

  const mainPool = scoredRecipes.filter(
    (sr) =>
      !sr.recipe.tags.some((t) => ["breakfast", "desayuno"].includes(t.toLowerCase()))
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

    // Select breakfast
    const bIndex = dayOffset % (breakfastPool.length || 1);
    const bEntry = breakfastPool[bIndex] || fallbackPool[dayOffset % fallbackPool.length];

    // Select lunch (offset to avoid same as dinner)
    const lPool = mainPool.length > 0 ? mainPool : fallbackPool;
    const lIndex = (dayOffset * 2) % lPool.length;
    const lEntry = lPool[lIndex] || fallbackPool[(dayOffset + 1) % fallbackPool.length];

    // Select dinner
    const dIndex = (dayOffset * 2 + 1) % lPool.length;
    const dEntry = lPool[dIndex] || fallbackPool[(dayOffset + 2) % fallbackPool.length];

    if (bEntry?.matchPercentage === 100) readyToCookMealsCount++;
    if (lEntry?.matchPercentage === 100) readyToCookMealsCount++;
    if (dEntry?.matchPercentage === 100) readyToCookMealsCount++;

    perishableSavedCount += (bEntry?.perishableUsedCount || 0) + (lEntry?.perishableUsedCount || 0) + (dEntry?.perishableUsedCount || 0);

    newPlan.push({
      date: dateStr,
      breakfast: bEntry?.recipe,
      lunch: lEntry?.recipe,
      dinner: dEntry?.recipe,
    });
  }

  return {
    newPlan,
    readyToCookMealsCount,
    perishableSavedCount,
  };
}
