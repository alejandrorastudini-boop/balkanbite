import { PantryItem, Recipe, ShoppingItem } from "../types";
import { findAuthoritativePantryItems } from "./menuAutoPlanner";
import { assessTotalAvailability, normalizeQuantity } from "./quantityUnits";
import { pantryItemNeedsExpiryReview } from "./effectiveExpiry";

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
  (value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");

const namesLikelyMatch = (a: string, b: string): boolean => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return Boolean(left && right && left === right);
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
  shoppingList: ShoppingItem[] = [],
  now: Date = new Date(),
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

  const matchingItems = findAuthoritativePantryItems(ingredient.name, pantry);
  const usableMatchingItems = matchingItems.filter(
    (item) => !pantryItemNeedsExpiryReview(item, now),
  );
  const hasExpiryReviewStock = usableMatchingItems.length < matchingItems.length;

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
    usableMatchingItems.map((item) => ({ quantity: item.quantity, unit: item.unit })),
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

  if (quantity <= 1e-9) {
    return {
      ingredientName: ingredient.name,
      status: "covered",
      quantity: 0,
      unit: requiredUnit,
      category: matchingItems[0]?.category || "Other",
    };
  }

  if (hasExpiryReviewStock) {
    return {
      ingredientName: ingredient.name,
      status: "unverified",
      quantity: requiredAmount,
      unit: requiredUnit,
      category: matchingItems[0]?.category || "Other",
    };
  }

  return {
    ingredientName: ingredient.name,
    status: "insufficient",
    quantity,
    unit: requiredUnit,
    category: matchingItems[0]?.category || "Other",
  };
}

function reserveVirtualQuantity(
  ingredient: Recipe["ingredients"][number],
  pantry: PantryItem[],
  shoppingList: ShoppingItem[],
  now: Date,
): void {
  const required = normalizeQuantity(Number(ingredient.amount), ingredient.unit || "");
  if (!required || required.baseQuantity <= 0) return;

  const matchingItems = findAuthoritativePantryItems(ingredient.name, pantry);
  const usableItems = matchingItems.filter(
    (item) => !pantryItemNeedsExpiryReview(item, now),
  );
  const hasReviewStock = usableItems.length < matchingItems.length;
  if (hasReviewStock) {
    const usableBase = usableItems.reduce((sum, item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return normalized?.unit.dimension === required.unit.dimension
        ? sum + normalized.baseQuantity
        : sum;
    }, 0);
    const pendingBase = shoppingList.reduce((sum, item) => {
      if (item.checked || !namesLikelyMatch(ingredient.name, item.name)) return sum;
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return normalized?.unit.dimension === required.unit.dimension
        ? sum + normalized.baseQuantity
        : sum;
    }, 0);
    if (usableBase + pendingBase + 1e-9 < required.baseQuantity) return;
  }

  let remaining = required.baseQuantity;
  for (const item of usableItems) {
    if (remaining <= 1e-9) break;
    const normalized = normalizeQuantity(item.quantity, item.unit);
    if (!normalized || normalized.unit.dimension !== required.unit.dimension) continue;
    const used = Math.min(normalized.baseQuantity, remaining);
    item.quantity = Math.max(
      0,
      (normalized.baseQuantity - used) / normalized.unit.factorToBase,
    );
    remaining -= used;
  }

  for (const item of shoppingList) {
    if (remaining <= 1e-9) break;
    if (item.checked || !namesLikelyMatch(ingredient.name, item.name)) continue;
    const normalized = normalizeQuantity(item.quantity, item.unit);
    if (!normalized || normalized.unit.dimension !== required.unit.dimension) continue;
    const used = Math.min(normalized.baseQuantity, remaining);
    item.quantity = Math.max(
      0,
      (normalized.baseQuantity - used) / normalized.unit.factorToBase,
    );
    remaining -= used;
  }
}

export function buildRecipeShoppingNeeds(
  recipe: Recipe,
  pantry: PantryItem[],
  shoppingList: ShoppingItem[] = [],
  now: Date = new Date(),
): {
  items: Array<Omit<ShoppingItem, "id" | "checked">>;
  unverified: RecipeShoppingNeedAssessment[];
} {
  const virtualPantry = pantry.map((item) => ({ ...item }));
  const virtualShopping = shoppingList.map((item) => ({ ...item }));
  const assessments = (recipe.ingredients || []).map((ingredient) => {
    const assessment = assessRecipeShoppingNeed(
      ingredient,
      virtualPantry,
      virtualShopping,
      now,
    );
    reserveVirtualQuantity(
      ingredient,
      virtualPantry,
      virtualShopping,
      now,
    );
    return assessment;
  });

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
      })),
    unverified: assessments.filter(
      (assessment) => assessment.status === "unverified"
    ),
  };
}
