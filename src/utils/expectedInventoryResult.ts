import type { PantryItem } from "../types";

export type ExpectedInventoryResult = Readonly<Record<string, number | null>>;

/**
 * Checks only explicitly affected lots against an owner/server-confirmed pantry
 * snapshot. null means the lot must be absent; a number must match exactly.
 * Unrelated lots are intentionally allowed because concurrent valid mutations
 * may change other stock between command preparation and confirmation.
 */
export function isExpectedInventoryResultVisible(
  expected: ExpectedInventoryResult,
  pantry: readonly PantryItem[],
): boolean {
  const entries = Object.entries(expected);
  if (entries.length === 0) return false;

  const visible = new Map(pantry.map(item => [item.id, item.quantity]));
  return entries.every(([itemId, quantity]) => {
    if (!itemId) return false;
    if (quantity === null) return !visible.has(itemId);
    return Number.isFinite(quantity) && quantity >= 0 &&
      visible.get(itemId) === quantity;
  });
}
