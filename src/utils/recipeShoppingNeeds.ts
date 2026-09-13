import { PantryItem, Recipe, ShoppingItem } from "../types";
import { findMatchingPantryItems } from "./menuAutoPlanner";
import { assessTotalAvailability, normalizeQuantity } from "./quantityUnits";

export type RecipeShoppingNeedStatus =
  | "covered"
  | "missing"
  | "insufficient"
  | "unverified";

export interface RecipeShoppingNeedAssessment {
  ingredientName: string;
  status: RecipeShoppingNeedStatus;
  quantity: number;
  unit: string;
  category: string;
}

const normalizeName = (value: string): string =>
  (value || "").trim().toLowerCase();

const namesLikelyMatch = (a: string, b: string): boolean => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

function subtractPendingShoppingQuantity(
  ingredientName: string,
  shortfallQuantity: number,
  requiredUnit: string,
  shoppingList: ShoppingItem[]
): number {
  const required = normalizeQuantity(shortfallQuantity, requiredUnit);
  if (!required) return shortfallQuantity;

  let remainingBase = required.baseQuantity;

  for (const item of shoppingList) {
    if (item.checked || !namesLikelyMatch(ingredientName, item.name)) continue;

    const pending = normalizeQuantity(item.quantity, item.unit);
    if (!pending || pending.unit.dimension !== required.unit.dimension) continue;

    remainingBase = Math.max(0, remainingBase - pending.baseQuantity);
    if (remainingBase <= 1e-9) return 0;
  }

  return remainingBase / required.unit.factorToBase;
}

export function assessRecipeShoppingNeed(
  ingredient: Recipe["ingredients"][number],
  pantry: PantryItem[],
  shoppingList: ShoppingItem[] = []
): RecipeShoppingNeedAssessment {
  const requiredAmount = Number(ingredient.amount);
  const requiredUnit = ingredient.unit || "";
  const required = normalizeQuantity(requiredAmount, requiredUnit);

  if (!required || requiredAmount <= 0) {
    return {
      ingredientName: ingredient.name,
      status: "unverified",
      quantity: requiredAmount,
      unit: requiredUnit,
      category: "Other",
    };
  }

  const matchingItems = findMatchingPantryItems(ingredient.name, pantry);
  if (matchingItems.length === 0) {
    const quantity = subtractPendingShoppingQuantity(
      ingredient.name,
      requiredAmount,
      requiredUnit,
      shoppingList
    );

    return {
      ingredientName: ingredient.name,
      status: quantity <= 1e-9 ? "covered" : "missing",
      quantity,
      unit: requiredUnit,
      category: "Other",
    };
  }

  const availability = assessTotalAvailability(
    matchingItems.map((item) => ({ quantity: item.quantity, unit: item.unit })),
    requiredAmount,
    requiredUnit
  );

  if (availability.status === "enough") {
    return {
      ingredientName: ingredient.name,
      status: "covered",
      quantity: 0,
      unit: requiredUnit,
      category: matchingItems[0]?.category || "Other",
    };
  }

  if (
    availability.status === "invalid" ||
    availability.status === "incompatible" ||
    availability.shortfallBase === undefined ||
    !availability.required
  ) {
    return {
      ingredientName: ingredient.name,
      status: "unverified",
      quantity: requiredAmount,
      unit: requiredUnit,
      category: matchingItems[0]?.category || "Other",
    };
  }

  const rawShortfall =
    availability.shortfallBase / availability.required.unit.factorToBase;
  const quantity = subtractPendingShoppingQuantity(
    ingredient.name,
    rawShortfall,
    requiredUnit,
    shoppingList
  );

  return {
    ingredientName: ingredient.name,
    status: quantity <= 1e-9 ? "covered" : "insufficient",
    quantity,
    unit: requiredUnit,
    category: matchingItems[0]?.category || "Other",
  };
}

export function buildRecipeShoppingNeeds(
  recipe: Recipe,
  pantry: PantryItem[],
  shoppingList: ShoppingItem[] = []
): {
  items: Array<Omit<ShoppingItem, "id" | "checked">>;
  unverified: RecipeShoppingNeedAssessment[];
} {
  const assessments = (recipe.ingredients || []).map((ingredient) =>
    assessRecipeShoppingNeed(ingredient, pantry, shoppingList)
  );

  return {
    items: assessments
      .filter(
        (assessment) =>
          assessment.status === "missing" || assessment.status === "insufficient"
      )
      .map((assessment) => ({
        name: assessment.ingredientName,
        quantity: assessment.quantity,
        unit: assessment.unit,
        category: assessment.category,
        // No verified price source exists in this path.
        estimatedPriceEUR: 0,
      })),
    unverified: assessments.filter(
      (assessment) => assessment.status === "unverified"
    ),
  };
}
