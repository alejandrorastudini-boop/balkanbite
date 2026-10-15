import { PantryItem } from "../types";
import { inventoryLotStateMatchesQuantity } from "./inventoryLots";
import { isSafeInventoryLogicalId } from "./inventoryIdentity";

export function getUserPantryCacheKey(userId: string): string {
  return `balkanbite_pantry_user_${userId}`;
}

const categories = new Set<PantryItem["category"]>([
  "Produce", "Dairy", "Meat/Fish", "Pantry/Grains", "Spices", "Other",
]);

function isCachedPantryItem(value: unknown): value is PantryItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const item = value as Record<string, unknown>;
  return (
    isSafeInventoryLogicalId(item.id) &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    typeof item.unit === "string" &&
    item.unit.trim().length > 0 &&
    categories.has(item.category as PantryItem["category"]) &&
    typeof item.addedAt === "string" &&
    item.addedAt.trim().length > 0 &&
    (item.lotState === undefined ||
      inventoryLotStateMatchesQuantity(item.quantity, item.unit, item.lotState as PantryItem["lotState"]))
  );
}

/**
 * Parse a signed-in user's local pantry cache for provisional startup display.
 *
 * This cache is never authoritative. Firestore remains the source of truth and
 * cloud inventory writes stay closed until the first remote snapshot hydrates.
 * Missing, malformed, or partially invalid cache data remains unknown.
 */
export function parseUserPantryCache(raw: string | null): PantryItem[] | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<string>();
    for (const item of parsed) {
      // Duplicated logical IDs make local stock ambiguous, even when both
      // rows individually pass quantity and unit validation. Preserve
      // uncertainty until the owner-scoped Firestore snapshot arrives.
      if (!isCachedPantryItem(item) || seen.has(item.id)) return null;
      seen.add(item.id);
    }
    return parsed;
  } catch {
    return null;
  }
}
