import { normalizeQuantity } from './quantityUnits';

export interface PantryConsumptionStock {
  id: string;
  quantity: number;
  unit: string;
}

export interface ConfirmedConsumption {
  pantryItemId: string;
  quantity: unknown;
  unit: unknown;
  confirmed: boolean;
}

export type ConsumptionDeductionRejection =
  | 'unconfirmed'
  | 'invalid-consumption'
  | 'stock-not-found'
  | 'ambiguous-stock'
  | 'invalid-stock'
  | 'incompatible-unit'
  | 'insufficient-stock';

export type ConsumptionDeductionResult =
  | {
      accepted: true;
      pantry: PantryConsumptionStock[];
      deducted: { pantryItemId: string; quantity: number; unit: string };
    }
  | {
      accepted: false;
      pantry: PantryConsumptionStock[];
      reason: ConsumptionDeductionRejection;
    };

function knownPositiveQuantity(quantity: unknown, unit: unknown) {
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    typeof unit !== 'string' ||
    !unit.trim()
  ) {
    return undefined;
  }

  const normalized = normalizeQuantity(quantity, unit);
  if (!normalized || !Number.isFinite(normalized.baseQuantity) || normalized.baseQuantity <= 0) {
    return undefined;
  }
  return normalized;
}

/**
 * Purely calculates one atomic deduction. Missing, unconfirmed, nonpositive,
 * unsupported, or dimension-incompatible quantities never alter pantry stock.
 */
export function deductConfirmedConsumption(
  pantry: readonly PantryConsumptionStock[],
  consumption: ConfirmedConsumption,
): ConsumptionDeductionResult {
  const unchanged = () => pantry.map(item => ({ ...item }));

  if (consumption.confirmed !== true) {
    return { accepted: false, pantry: unchanged(), reason: 'unconfirmed' };
  }

  const requested = knownPositiveQuantity(consumption.quantity, consumption.unit);
  if (!requested) {
    return { accepted: false, pantry: unchanged(), reason: 'invalid-consumption' };
  }

  const pantryItemId = typeof consumption.pantryItemId === 'string'
    ? consumption.pantryItemId.trim()
    : '';
  const matches = pantry.filter(item => item.id === pantryItemId);
  if (matches.length === 0) {
    return { accepted: false, pantry: unchanged(), reason: 'stock-not-found' };
  }
  if (matches.length > 1) {
    return { accepted: false, pantry: unchanged(), reason: 'ambiguous-stock' };
  }

  const available = knownPositiveQuantity(matches[0].quantity, matches[0].unit);
  if (!available) {
    return { accepted: false, pantry: unchanged(), reason: 'invalid-stock' };
  }
  if (available.unit.dimension !== requested.unit.dimension) {
    return { accepted: false, pantry: unchanged(), reason: 'incompatible-unit' };
  }
  if (requested.baseQuantity > available.baseQuantity) {
    return { accepted: false, pantry: unchanged(), reason: 'insufficient-stock' };
  }

  const remainingBase = available.baseQuantity - requested.baseQuantity;
  const remainingQuantity = remainingBase === 0
    ? 0
    : remainingBase / available.unit.factorToBase;

  return {
    accepted: true,
    pantry: pantry.map(item => item.id === pantryItemId
      ? { ...item, quantity: remainingQuantity }
      : { ...item }),
    deducted: {
      pantryItemId,
      quantity: consumption.quantity as number,
      unit: consumption.unit as string,
    },
  };
}
