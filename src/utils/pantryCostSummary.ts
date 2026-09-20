import type { PantryItem } from "../types";

export interface PantryCostSummary {
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

/**
 * Pantry value is only complete when every item carries a finite non-negative
 * numeric EUR cost. null is an explicit unknown/partial sentinel and must
 * never be coerced to zero.
 */
export function summarizePantryCosts(
  pantry: readonly Pick<PantryItem, "estimatedCostEUR">[],
): PantryCostSummary {
  let total = 0;
  let knownItemCount = 0;

  for (const item of pantry) {
    const known = knownPantryCostEUR(item.estimatedCostEUR);
    if (known === null) continue;
    knownItemCount += 1;
    total += known;
  }

  const unknownItemCount = pantry.length - knownItemCount;
  const complete = unknownItemCount === 0;

  return {
    totalEUR: complete ? total : null,
    knownItemCount,
    unknownItemCount,
    complete,
  };
}