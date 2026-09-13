import { PantryItem, RecipeIngredient } from "../types";
import { findMatchingPantryItems } from "./menuAutoPlanner";
import { normalizeQuantity } from "./quantityUnits";

export type PantryConsumptionIssueReason =
  | "invalid_requirement"
  | "no_matching_item"
  | "incompatible_unit"
  | "insufficient_quantity";

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

const sortConsumptionCandidates = (items: PantryItem[]): PantryItem[] =>
  [...items].sort((a, b) => {
    const aExpiry = a.expiryDaysLeft ?? Number.POSITIVE_INFINITY;
    const bExpiry = b.expiryDaysLeft ?? Number.POSITIVE_INFINITY;
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
  ingredients: RecipeIngredient[]
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

    const matchingItems = findMatchingPantryItems(ingredient.name, workingPantry);
    if (matchingItems.length === 0) {
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: "no_matching_item",
      });
      continue;
    }

    const compatibleItems = sortConsumptionCandidates(matchingItems).filter((item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return Boolean(
        normalized && normalized.unit.dimension === required.unit.dimension
      );
    });

    if (compatibleItems.length === 0) {
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: "incompatible_unit",
      });
      continue;
    }

    const totalCompatibleBase = compatibleItems.reduce((sum, item) => {
      const normalized = normalizeQuantity(item.quantity, item.unit);
      return sum + (normalized?.baseQuantity || 0);
    }, 0);

    if (totalCompatibleBase + 1e-9 < required.baseQuantity) {
      issues.push({
        ingredientName: ingredient.name,
        requiredAmount: ingredient.amount,
        requiredUnit: ingredient.unit,
        reason: "insufficient_quantity",
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
        };
      }

      remainingRequiredBase -= consumedBase;
    }
  }

  return {
    pantry: workingPantry,
    deductions,
    issues,
  };
}
