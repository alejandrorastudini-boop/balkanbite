import type { ShoppingItem } from "../types";
import type { GuestPantryStorage } from "./guestPantry";
import { hasPendingGuestMutationJournal } from "./guestJournalExclusivity";
import { guestShoppingCacheIsComplete } from "./guestDerivedShoppingRecovery";
import {
  isStoredShoppingItemStructurallyValid,
  parseStoredShoppingCache,
} from "./storedShoppingValidation";

const SHOPPING_KEY = "balkanbite_shopping";
export type GuestShoppingDeleteCommit =
  | { saved: true; next: ShoppingItem[] }
  | { saved: false; reason: "invalid-view" | "incomplete" | "stale-snapshot" |
      "journal-pending" | "missing-row" | "storage-unavailable" };

/**
 * Delete only from an unfiltered, valid, unique and visible guest shopping
 * snapshot. Never treat optimistic React removal as persisted; unknown
 * historical bytes must remain recoverable. localStorage is NOT atomic CAS.
 */
export function commitVerifiedGuestShoppingDelete(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
  id: string,
): GuestShoppingDeleteCommit {
  return commitVerifiedGuestShoppingRemoval(storage, visible, id);
}

/** Clear uses the same guarded single-key commit as individual deletion. */
export function commitVerifiedGuestShoppingClear(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
): GuestShoppingDeleteCommit {
  return commitVerifiedGuestShoppingRemoval(storage, visible, null);
}

function commitVerifiedGuestShoppingRemoval(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
  id: string | null,
): GuestShoppingDeleteCommit {
  if (!Array.isArray(visible) ||
      !visible.every(isStoredShoppingItemStructurallyValid) ||
      new Set(visible.map(row => row.id)).size !== visible.length) {
    return { saved: false, reason: "invalid-view" };
  }
  if (id !== null && (typeof id !== "string" || !id.trim())) {
    return { saved: false, reason: "missing-row" };
  }
  try {
    if (hasPendingGuestMutationJournal(storage)) {
      return { saved: false, reason: "journal-pending" };
    }
    const before = storage.getItem(SHOPPING_KEY);
    if (before === null && id === null && visible.length === 0) {
      // Clearing a genuinely absent, visibly empty key is a no-op, not a
      // reason to manufacture or overwrite any unknown historical rows.
      return { saved: true, next: [] };
    }
    if (before === null || !guestShoppingCacheIsComplete(before)) {
      return { saved: false, reason: "incomplete" };
    }
    const current = parseStoredShoppingCache(before);
    if (!current ||
        new Set(current.map(row => row.id)).size !== current.length ||
        JSON.stringify(current) !== JSON.stringify(visible)) {
      return { saved: false, reason: "stale-snapshot" };
    }
    if (id !== null && !current.some(row => row.id === id)) {
      return { saved: false, reason: "missing-row" };
    }
    const next = id === null ? [] : current.filter(row => row.id !== id);
    if (hasPendingGuestMutationJournal(storage)) {
      return { saved: false, reason: "journal-pending" };
    }
    if (storage.getItem(SHOPPING_KEY) !== before) {
      return { saved: false, reason: "stale-snapshot" };
    }
    const serialized = JSON.stringify(next);
    storage.setItem(SHOPPING_KEY, serialized);
    if (storage.getItem(SHOPPING_KEY) !== serialized) {
      return { saved: false, reason: "storage-unavailable" };
    }
    return { saved: true, next };
  } catch {
    return { saved: false, reason: "storage-unavailable" };
  }
}
