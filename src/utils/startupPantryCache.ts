import { PantryItem } from "../types";

export function getUserPantryCacheKey(userId: string): string {
  return `balkanbite_pantry_user_${userId}`;
}

function isCachedPantryItem(value: unknown): value is PantryItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    typeof item.unit === "string" &&
    item.unit.trim().length > 0
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
    if (!parsed.every(isCachedPantryItem)) return null;
    return parsed;
  } catch {
    return null;
  }
}
