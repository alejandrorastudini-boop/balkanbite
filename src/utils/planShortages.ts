import { normalizeQuantity } from './quantityUnits';

export interface PlannedIngredientRequirement {
  ingredientId: unknown;
  foodName: unknown;
  quantity: unknown;
  unit: unknown;
}

export interface PlanPantryStock {
  id: string;
  foodName: unknown;
  quantity: unknown;
  unit: unknown;
}

export interface PlanShortage {
  ingredientId: string;
  foodName: string;
  quantity: number;
  unit: string;
}

export interface PendingPlanRequirement {
  ingredientId: string | undefined;
  reason:
    | 'invalid-ingredient'
    | 'invalid-quantity'
    | 'invalid-unit'
    | 'invalid-pantry-stock'
    | 'incompatible-pantry-stock';
}

export interface PlanShortageResult {
  shortages: PlanShortage[];
  pending: PendingPlanRequirement[];
}

type KnownQuantity = NonNullable<ReturnType<typeof normalizeQuantity>>;

function knownText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function foodKey(value: unknown): string | undefined {
  const name = knownText(value);
  return name?.toLocaleLowerCase().replace(/\s+/g, ' ');
}

function knownQuantity(quantity: unknown, unit: unknown): KnownQuantity | undefined {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) return undefined;
  const unitName = knownText(unit);
  return unitName ? normalizeQuantity(quantity, unitName) : undefined;
}

/**
 * Derives only deficits that are knowable from an already-confirmed plan.
 * Unknown requirements and stock never become a guessed shopping quantity.
 */
export function computePlanShortages(
  requirements: readonly PlannedIngredientRequirement[],
  pantry: readonly PlanPantryStock[],
): PlanShortageResult {
  const remainingStock = pantry.map(stock => ({ ...stock }));
  const shortages: PlanShortage[] = [];
  const pending: PendingPlanRequirement[] = [];

  for (const requirement of requirements) {
    const ingredientId = knownText(requirement.ingredientId);
    const foodName = knownText(requirement.foodName);
    const key = foodKey(requirement.foodName);
    if (!ingredientId || !foodName || !key) {
      pending.push({ ingredientId, reason: 'invalid-ingredient' });
      continue;
    }

    if (typeof requirement.quantity !== 'number' || !Number.isFinite(requirement.quantity) || requirement.quantity <= 0) {
      pending.push({ ingredientId, reason: 'invalid-quantity' });
      continue;
    }
    if (!knownText(requirement.unit) || !knownQuantity(requirement.quantity, requirement.unit)) {
      pending.push({ ingredientId, reason: 'invalid-unit' });
      continue;
    }

    const requested = knownQuantity(requirement.quantity, requirement.unit)!;
    const sameFood = remainingStock.filter(stock => foodKey(stock.foodName) === key);
    const normalizedStock = sameFood.map(stock => ({ stock, quantity: knownQuantity(stock.quantity, stock.unit) }));
    if (normalizedStock.some(entry => !entry.quantity)) {
      pending.push({ ingredientId, reason: 'invalid-pantry-stock' });
      continue;
    }

    const compatible = normalizedStock.filter(entry => entry.quantity!.unit.dimension === requested.unit.dimension);
    if (sameFood.length > 0 && compatible.length === 0) {
      pending.push({ ingredientId, reason: 'incompatible-pantry-stock' });
      continue;
    }

    const availableBase = compatible.reduce((total, entry) => total + entry.quantity!.baseQuantity, 0);
    const missingBase = Math.max(0, requested.baseQuantity - availableBase);
    if (missingBase > 0) {
      shortages.push({
        ingredientId,
        foodName,
        quantity: missingBase / requested.unit.factorToBase,
        unit: knownText(requirement.unit)!,
      });
    }

    let toReserve = Math.min(requested.baseQuantity, availableBase);
    for (const entry of compatible) {
      if (toReserve <= 0) break;
      const usedBase = Math.min(toReserve, entry.quantity!.baseQuantity);
      entry.stock.quantity = (entry.quantity!.baseQuantity - usedBase) / entry.quantity!.unit.factorToBase;
      toReserve -= usedBase;
    }
  }

  return { shortages, pending };
}
