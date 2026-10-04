import { PantryItem, RecipeIngredient } from "../types";
import { findAuthoritativePantryItems } from "./menuAutoPlanner";
import { normalizeQuantity } from "./quantityUnits";
import {
  derivePantryItemExpiry,
  pantryItemNeedsExpiryReview,
} from "./effectiveExpiry";

export type PantryConsumptionIssueReason =
  | "invalid_requirement"
  | "no_matching_item"
  | "incompatible_unit"
  | "insufficient_quantity"
  | "expiry_review_required";

export interface PantryConsumptionIssue {
  ingredientName: string;
  requiredAmount: number;
  requiredUnit: string;
  reason: PantryConsumptionIssueReason;
}

export interface PantryConsumptionDeduction {
  ingredientName: string;
  pantryItemId: string;
  consumedQuantity: number;
  unit: string;
}

export interface PantryConsumptionResult {
  pantry: PantryItem[];
  deductions: PantryConsumptionDeduction[];
  issues: PantryConsumptionIssue[];
}

export interface VoiceRemovalItem {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
}

const sortConsumptionCandidates = (
  items: PantryItem[],
  now: Date,
): PantryItem[] =>
  [...items].sort((a, b) => {
    const aEffective = derivePantryItemExpiry(a, now);
    const bEffective = derivePantryItemExpiry(b, now);
    const aExpiry =
      aEffective.status === "known" && !aEffective.expired
        ? aEffective.daysRemaining
        : Number.POSITIVE_INFINITY;
    const bExpiry =
      bEffective.status === "known" && !bEffective.expired
        ? bEffective.daysRemaining
        : Number.POSITIVE_INFINITY;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;

    const aAddedAt = a.addedAt || "";
    const bAddedAt = b.addedAt || "";
    if (aAddedAt !== bAddedAt) return aAddedAt.localeCompare(bAddedAt);

    return a.id.localeCompare(b.id);
  });

const roundQuantity = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export function deductRecipeIngredientsFromPantry(
  pantry: PantryItem[],
  ingredients: RecipeIngredient[],
  now: Date = new Date(),
  requireExpiryReview = true,
): PantryConsumptionResult {
  let workingPantry = pantry.map((item) => ({ ...item }));
  const deductions: PantryConsumptionDeduction[] = [];
  const issues: PantryConsumptionIssue[] = [];

  for (const ingredient of ingredients || []) {
    const required = normalizeQuantity(ingredient.amount, ingredient.unit);
    if (!required || required.baseQuantity <= 0) {
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: "invalid_requirement",
      });
      continue;
    }

    const matchingItems = findAuthoritativePantryItems(ingredient.name, workingPantry);
    if (matchingItems.length === 0) {
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: "no_matching_item",
      });
      continue;
    }

    const compatibleMatchingItems = matchingItems.filter((item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return Boolean(
        normalized && normalized.unit.dimension === required.unit.dimension
      );
    });

    const compatibleItems = sortConsumptionCandidates(
      compatibleMatchingItems.filter(
        (item) =>
          !requireExpiryReview || !pantryItemNeedsExpiryReview(item, now),
      ),
      now,
    );

    if (compatibleItems.length === 0) {
      const hasCompatibleReviewStock =
        requireExpiryReview &&
        compatibleMatchingItems.some(
          (item) => pantryItemNeedsExpiryReview(item, now),
        );
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: hasCompatibleReviewStock
          ? "expiry_review_required"
          : "incompatible_unit",
      });
      continue;
    }

    const totalCompatibleBase = compatibleItems.reduce((sum, item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return sum + (normalized?.baseQuantity || 0);
    }, 0);

    if (totalCompatibleBase + 1e-9 < required.baseQuantity) {
      const reviewCompatibleBase = requireExpiryReview
        ? compatibleMatchingItems
        .filter((item) => pantryItemNeedsExpiryReview(item, now))
        .reduce((sum, item) => {
          const normalized = normalizeQuantity(item.quantity, item.unit);
          return sum + (normalized?.baseQuantity || 0);
        }, 0)
        : 0;
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason:
          totalCompatibleBase + reviewCompatibleBase + 1e-9 >= required.baseQuantity
            ? "expiry_review_required"
            : "insufficient_quantity",
      });
      continue;
    }

    let remainingRequiredBase = required.baseQuantity;

    for (const candidate of compatibleItems) {
      if (remainingRequiredBase <= 1e-9) break;

      const index = workingPantry.findIndex((item) => item.id === candidate.id);
      if (index === -1) continue;

      const current = workingPantry[index];
      const normalizedCurrent = normalizeQuantity(current.quantity, current.unit);
      if (
        !normalizedCurrent ||
        normalizedCurrent.unit.dimension !== required.unit.dimension
      ) {
        continue;
      }

      const consumedBase = Math.min(
        normalizedCurrent.baseQuantity,
        remainingRequiredBase
      );
      const consumedInItemUnit = consumedBase / normalizedCurrent.unit.factorToBase;
      const remainingBase = normalizedCurrent.baseQuantity - consumedBase;
      const remainingInItemUnit = remainingBase / normalizedCurrent.unit.factorToBase;

      deductions.push({
        ingredientName: ingredient.name,
        pantryItemId: current.id,
        consumedQuantity: roundQuantity(consumedInItemUnit),
        unit: current.unit,
      });

      if (remainingBase <= 1e-9) {
        workingPantry.splice(index, 1);
      } else {
        workingPantry[index] = {
          ...current,
          quantity: roundQuantity(remainingInItemUnit),
          // Quantity changed without new monetary evidence. Legacy/current
          // estimatedCostEUR cannot be assumed to be the value of the
          // remaining stock, so keep money unknown instead of stale.
          estimatedCostEUR: null,
        };
      }

      remainingRequiredBase -= consumedBase;
    }
  }

  if (issues.length > 0) {
    return {
      pantry: pantry.map((item) => ({ ...item })),
      deductions: [],
      issues,
    };
  }

  return {
    pantry: workingPantry,
    deductions,
    issues,
  };
}

/**
 * Safely applies REMOVE_ITEMS output from the voice intent parser.
 * Missing/invalid units are intentionally not defaulted: without a trustworthy
 * unit we cannot know whether a numeric quantity means grams, pieces, packs, etc.
 */
export function deductVoiceItemsFromPantry(
  pantry: PantryItem[],
  items: VoiceRemovalItem[],
  now: Date = new Date(),
): PantryConsumptionResult {
  const ingredients: RecipeIngredient[] = (items || []).map((item) => ({
    name: typeof item.name === "string" ? item.name.trim() : "",
    amount:
      typeof item.quantity === "number"
        ? item.quantity
        : typeof item.quantity === "string"
        ? Number(item.quantity)
        : Number.NaN,
    unit: typeof item.unit === "string" ? item.unit.trim() : "",
    inPantry: true,
  }));

  // A confirmed voice REMOVE_ITEMS action may represent disposal, not eating.
  // It must be able to remove review-required stock without claiming it was
  // suitable for consumption.
  return deductRecipeIngredientsFromPantry(pantry, ingredients, now, false);
}
