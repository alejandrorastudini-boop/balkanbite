import { deriveEffectiveExpiry, type EffectiveExpiry } from "./effectiveExpiry";
import { normalizeQuantity } from "./quantityUnits";

export type InventoryLotSource =
  | "shopping_list"
  | "confirmed_reconciliation";

export interface InventoryLot {
  /** Stable acquisition provenance identity; not a display name. */
  id: string;
  sourceId: string;
  source: InventoryLotSource;
  acquiredAt: string;
  /** Stored in the parent PantryItem unit. */
  initialQuantity: number;
  remainingQuantity: number;
  /** Whole calendar days from acquiredAt when explicitly evidenced. */
  expiryDaysAtAcquisition?: number;
  /** Optional initial line cost evidence. Never a mutable remaining value. */
  initialCostEUR?: number;
}

export interface InventoryLotState {
  /** Stock whose acquisition-lot allocation is unknown. */
  unallocatedQuantity: number;
  activeLots: InventoryLot[];
}

const EPSILON = 1e-9;

const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const safeEmbeddedIdentity = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 450 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const validCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
};

export function isValidInventoryLot(lot: InventoryLot): boolean {
  return Boolean(
    lot &&
    safeEmbeddedIdentity(lot.id) &&
    safeEmbeddedIdentity(lot.sourceId) &&
    (lot.source === "shopping_list" ||
      lot.source === "confirmed_reconciliation") &&
    validCalendarDate(lot.acquiredAt) &&
    finitePositive(lot.initialQuantity) &&
    finitePositive(lot.remainingQuantity) &&
    lot.remainingQuantity <= lot.initialQuantity + EPSILON &&
    (lot.expiryDaysAtAcquisition === undefined ||
      (finiteNonnegative(lot.expiryDaysAtAcquisition) &&
        Number.isInteger(lot.expiryDaysAtAcquisition))) &&
    (lot.initialCostEUR === undefined ||
      finiteNonnegative(lot.initialCostEUR))
  );
}

export function inventoryLotStateMatchesQuantity(
  pantryQuantity: unknown,
  pantryUnit: unknown,
  state: InventoryLotState,
): boolean {
  if (
    !finitePositive(pantryQuantity) ||
    typeof pantryUnit !== "string" ||
    !pantryUnit.trim() ||
    !normalizeQuantity(pantryQuantity, pantryUnit) ||
    !state ||
    !finiteNonnegative(state.unallocatedQuantity) ||
    !Array.isArray(state.activeLots)
  ) {
    return false;
  }

  const ids = new Set<string>();
  const sourceIds = new Set<string>();
  let total = state.unallocatedQuantity;
  for (const lot of state.activeLots) {
    if (
      !isValidInventoryLot(lot) ||
      ids.has(lot.id) ||
      sourceIds.has(lot.sourceId)
    ) {
      return false;
    }
    ids.add(lot.id);
    sourceIds.add(lot.sourceId);
    total += lot.remainingQuantity;
  }

  return Math.abs(total - pantryQuantity) <= EPSILON;
}

export function deriveInventoryLotExpiry(
  lot: InventoryLot,
  now: Date = new Date(),
): EffectiveExpiry {
  if (!isValidInventoryLot(lot)) return { status: "unknown" };
  return deriveEffectiveExpiry(
    lot.expiryDaysAtAcquisition,
    lot.acquiredAt,
    now,
  );
}

/**
 * Converts explicit acquisition quantity into the parent PantryItem unit.
 * Returns null rather than inventing a conversion for incompatible dimensions.
 */
export function quantityInParentUnit(
  quantity: unknown,
  sourceUnit: unknown,
  parentUnit: unknown,
): number | null {
  if (
    !finitePositive(quantity) ||
    typeof sourceUnit !== "string" ||
    typeof parentUnit !== "string"
  ) {
    return null;
  }
  const source = normalizeQuantity(quantity, sourceUnit);
  const parent = normalizeQuantity(1, parentUnit);
  if (!source || !parent || source.unit.dimension !== parent.unit.dimension) {
    return null;
  }
  const converted = source.baseQuantity / parent.unit.factorToBase;
  return Number.isFinite(converted) && converted > 0
    ? Number(converted.toPrecision(15))
    : null;
}


export interface ConfirmedAcquisitionLotInput {
  sourceId: string;
  source: InventoryLotSource;
  acquiredAt: string;
  quantity: number;
  unit: string;
  parentUnit: string;
  expiryDaysAtAcquisition?: number;
}

/**
 * Builds active-lot state only from explicit confirmed acquisition evidence.
 * It does not infer purchase provenance for generic/manual pantry stock.
 */
export function buildInventoryLotFromConfirmedAcquisition(
  input: ConfirmedAcquisitionLotInput,
): InventoryLot | null {
  const converted = quantityInParentUnit(
    input.quantity,
    input.unit,
    input.parentUnit,
  );
  if (
    !safeEmbeddedIdentity(input.sourceId) ||
    (input.source !== "shopping_list" &&
      input.source !== "confirmed_reconciliation") ||
    !validCalendarDate(input.acquiredAt) ||
    converted === null ||
    (input.expiryDaysAtAcquisition !== undefined &&
      (!finiteNonnegative(input.expiryDaysAtAcquisition) ||
        !Number.isInteger(input.expiryDaysAtAcquisition)))
  ) {
    return null;
  }

  const lot: InventoryLot = {
    id: `acquisition:${input.sourceId}`,
    sourceId: input.sourceId,
    source: input.source,
    acquiredAt: input.acquiredAt,
    initialQuantity: converted,
    remainingQuantity: converted,
    ...(input.expiryDaysAtAcquisition !== undefined
      ? { expiryDaysAtAcquisition: input.expiryDaysAtAcquisition }
      : {}),
  };
  return isValidInventoryLot(lot) ? lot : null;
}

export function appendConfirmedInventoryLot(
  pantryQuantityBefore: number,
  pantryQuantityAfter: number,
  pantryUnit: string,
  stateBefore: InventoryLotState,
  lot: InventoryLot,
): InventoryLotState | null {
  if (
    !inventoryLotStateMatchesQuantity(
      pantryQuantityBefore,
      pantryUnit,
      stateBefore,
    ) ||
    !isValidInventoryLot(lot) ||
    stateBefore.activeLots.some(
      (existing) =>
        existing.id === lot.id || existing.sourceId === lot.sourceId,
    )
  ) {
    return null;
  }

  const stateAfter: InventoryLotState = {
    unallocatedQuantity: stateBefore.unallocatedQuantity,
    activeLots: [...stateBefore.activeLots, lot],
  };
  return inventoryLotStateMatchesQuantity(
    pantryQuantityAfter,
    pantryUnit,
    stateAfter,
  )
    ? stateAfter
    : null;
}
