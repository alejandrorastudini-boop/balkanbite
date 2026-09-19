import type { PantryItem } from "../types";
import { SAMPLE_PANTRY } from "../data/initialData";

const DEMO_PANTRY_ITEM_IDS = new Set(SAMPLE_PANTRY.map((item) => item.id));

/**
 * Guest pantry state must come only from user-owned local data.
 * Missing or malformed local state is empty; known demo rows are removed so
 * historical sample data cannot masquerade as real household inventory.
 */
export function loadGuestPantry(raw: string | null): PantryItem[] {
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is PantryItem => {
      if (!item || typeof item !== "object") return false;
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" && !DEMO_PANTRY_ITEM_IDS.has(id);
    });
  } catch {
    return [];
  }
}
