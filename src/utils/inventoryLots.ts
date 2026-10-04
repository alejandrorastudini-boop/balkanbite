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

const safeId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9._:-]{1,180}$/.test(value);

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
    safeId(lot.id) &&
    safeId(lot.sourceId) &&
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
  quantity: number;
  unit: string;
  acquiredAt: string;
  expiryDaysAtAcquisition?: number;
  initialCostEUR?: number;
}

/**
 * Creates active-lot state only from explicit acquisition evidence.
 * The quantity is converted into the parent PantryItem unit. Invalid or
 * incompatible evidence fails closed instead of fabricating a lot.
 */
export function buildInventoryLotFromConfirmedAcquisition(
  input: ConfirmedAcquisitionLotInput,
  parentUnit: string,
): InventoryLot | null {
  const parentQuantity = quantityInParentUnit(
    input.quantity,
    input.unit,
    parentUnit,
  );
  if (parentQuantity === null) return null;

  const lot: InventoryLot = {
    id: `lot:${input.sourceId}`,
    sourceId: input.sourceId,
    source: input.source,
    acquiredAt: input.acquiredAt,
    initialQuantity: parentQuantity,
    remainingQuantity: parentQuantity,
    ...(input.expiryDaysAtAcquisition !== undefined
      ? { expiryDaysAtAcquisition: input.expiryDaysAtAcquisition }
      : {}),
    ...(input.initialCostEUR !== undefined
      ? { initialCostEUR: input.initialCostEUR }
      : {}),
  };
  return isValidInventoryLot(lot) ? lot : null;
}

/**
 * Adds a newly confirmed acquisition to an existing lot state. Duplicate
 * source provenance is an idempotent no-op; duplicate lot identity with
 * different provenance fails closed.
 */
export function addConfirmedAcquisitionLot(
  state: InventoryLotState,
  lot: InventoryLot,
): InventoryLotState | null {
  if (
    !state ||
    !finiteNonnegative(state.unallocatedQuantity) ||
    !Array.isArray(state.activeLots) ||
    !isValidInventoryLot(lot)
  ) {
    return null;
  }
  if (state.activeLots.some((existing) => existing.sourceId === lot.sourceId)) {
    return state;
  }
  if (state.activeLots.some((existing) => existing.id === lot.id)) {
    return null;
  }
  return {
    unallocatedQuantity: state.unallocatedQuantity,
    activeLots: [...state.activeLots, lot],
  };
}


export interface LegacyPantryQuantity {
  quantity: number;
  unit: string;
}

/**
 * Read-only compatibility adapter for pantry rows created before explicit lot
 * state exists. Current quantity remains authoritative stock, but all of it is
 * acquisition-unallocated. This function never mutates or invents provenance.
 */
export function legacyPantryQuantityToLotState(
  item: LegacyPantryQuantity,
): InventoryLotState | null {
  if (
    !item ||
    !finitePositive(item.quantity) ||
    typeof item.unit !== "string" ||
    !item.unit.trim() ||
    !normalizeQuantity(item.quantity, item.unit)
  ) {
    return null;
  }
  return {
    unallocatedQuantity: item.quantity,
    activeLots: [],
  };
}


/**
 * Pure transition used before any persistence integration: existing aggregate
 * stock is treated as unallocated unless explicit lot state already exists,
 * then the confirmed acquisition is appended as its own active lot.
 */
export function applyConfirmedAcquisitionToLotState(
  currentQuantity: number,
  parentUnit: string,
  currentState: InventoryLotState | undefined,
  acquisition: ConfirmedAcquisitionLotInput,
): InventoryLotState | null {
  const baseState = currentState ??
    legacyPantryQuantityToLotState({
      quantity: currentQuantity,
      unit: parentUnit,
    });
  if (!baseState ||
      !inventoryLotStateMatchesQuantity(currentQuantity, parentUnit, baseState)) {
    return null;
  }

  const lot = buildInventoryLotFromConfirmedAcquisition(
    acquisition,
    parentUnit,
  );
  if (!lot) return null;

  const next = addConfirmedAcquisitionLot(baseState, lot);
  if (!next) return null;

  const nextQuantity = currentQuantity + lot.remainingQuantity;
  return inventoryLotStateMatchesQuantity(nextQuantity, parentUnit, next)
    ? next
    : null;
}
