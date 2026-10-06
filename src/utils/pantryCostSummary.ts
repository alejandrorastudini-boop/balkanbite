import type { InventoryLotState } from "../types";
import { inventoryLotStateMatchesQuantity } from "./inventoryLots";

export interface PantryCostSummary {
  /** Sum of items with defensible current cost evidence; never presented as a complete pantry total by itself. */
  knownSubtotalEUR: number;
  totalEUR: number | null;
  knownItemCount: number;
  unknownItemCount: number;
  complete: boolean;
}

export function knownPantryCostEUR(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : null;
}

type PantryCostEvidence = {
  estimatedCostEUR?: unknown;
  quantity?: unknown;
  unit?: unknown;
  lotState?: InventoryLotState;
};

/**
 * Returns a defensible current item value only from explicit monetary evidence.
 *
 * The aggregate estimate wins while it is still authoritative. After an exact
 * lot deduction writers deliberately invalidate that aggregate estimate; in
 * that case we can derive remaining value from acquisition lots only when the
 * entire remaining quantity is allocated to valid lots and every active lot
 * has an initial cost. Any unallocated quantity or missing lot cost keeps value
 * unknown rather than inventing a blended unit price.
 */
export function knownPantryRemainingCostEUR(
  item: PantryCostEvidence,
): number | null {
  const aggregate = knownPantryCostEUR(item.estimatedCostEUR);
  if (aggregate !== null) return aggregate;

  if (
    typeof item.quantity !== "number" ||
    typeof item.unit !== "string" ||
    !item.lotState ||
    !inventoryLotStateMatchesQuantity(item.quantity, item.unit, item.lotState) ||
    item.lotState.unallocatedQuantity > 1e-9
  ) {
    return null;
  }

  let total = 0;
  for (const lot of item.lotState.activeLots) {
    const initialCost = knownPantryCostEUR(lot.initialEstimatedCostEUR);
    if (initialCost === null || lot.initialQuantity <= 0) return null;
    total += initialCost * (lot.remainingQuantity / lot.initialQuantity);
  }

  return Number.isFinite(total) && total >= 0
    ? Number(total.toPrecision(15))
    : null;
}

/**
 * Pantry value is complete only when every item has defensible current cost
 * evidence. Unknown/partial evidence never becomes zero.
 */
export function summarizePantryCosts(
  pantry: readonly PantryCostEvidence[],
): PantryCostSummary {
  let total = 0;
  let knownItemCount = 0;

  for (const item of pantry) {
    const known = knownPantryRemainingCostEUR(item);
    if (known === null) continue;
    knownItemCount += 1;
    total += known;
  }

  const unknownItemCount = pantry.length - knownItemCount;
  const complete = unknownItemCount === 0;

  return {
    knownSubtotalEUR: total,
    totalEUR: complete ? total : null,
    knownItemCount,
    unknownItemCount,
    complete,
  };
}
