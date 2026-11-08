import type { ShoppingItem } from "../types";
import type { GuestPantryStorage } from "./guestPantry";
import { hasPendingGuestMutationJournal } from "./guestJournalExclusivity";
import {
  isStoredShoppingItemStructurallyValid,
  parseStoredShoppingCache,
} from "./storedShoppingValidation";
import { guestShoppingCacheIsComplete } from "./guestDerivedShoppingRecovery";

const KEY = "balkanbite_shopping";

export type GuestShoppingToggleCommit =
  | { saved: true; next: ShoppingItem[] }
  | { saved: false; reason: "invalid-view" | "incomplete" | "stale-snapshot" |
      "journal-pending" | "missing-row" | "storage-unavailable" };

/**
 * A checked purchase cannot be reported as saved from React state alone.
 * The complete, non-filtered guest shopping snapshot must match the visible
 * list before and after an unmodified localStorage write. This is not an
 * atomic cross-tab CAS; later tabs can still modify the key.
 */
export function commitVerifiedGuestShoppingToggle(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
  id: string,
): GuestShoppingToggleCommit {
  if (!Array.isArray(visible) || !visible.every(isStoredShoppingItemStructurallyValid) ||
      new Set(visible.map(item => item.id)).size !== visible.length) {
    return { saved: false, reason: "invalid-view" };
  }
  if (typeof id !== "string" || !id.trim()) {
    return { saved: false, reason: "missing-row" };
  }
  try {
    if (hasPendingGuestMutationJournal(storage)) {
      return { saved: false, reason: "journal-pending" };
    }
    const before = storage.getItem(KEY);
    if (before === null || !guestShoppingCacheIsComplete(before)) {
      return { saved: false, reason: "incomplete" };
    }
    const actual = parseStoredShoppingCache(before);
    if (!actual ||
        new Set(actual.map(item => item.id)).size !== actual.length ||
        JSON.stringify(actual) !== JSON.stringify(visible)) {
      return { saved: false, reason: "stale-snapshot" };
    }
    const rowIndex = actual.findIndex(item => item.id === id);
    if (rowIndex < 0) return { saved: false, reason: "missing-row" };
    const next = actual.map((item, index) =>
      index === rowIndex
        ? { ...item, checked: !item.checked, purchaseAmountConfirmed: !item.checked }
        : item,
    );
    // The guest journal may have appeared in another tab after the first read.
    if (hasPendingGuestMutationJournal(storage)) {
      return { saved: false, reason: "journal-pending" };
    }
    if (storage.getItem(KEY) !== before) {
      return { saved: false, reason: "stale-snapshot" };
    }
    const serialized = JSON.stringify(next);
    storage.setItem(KEY, serialized);
    if (storage.getItem(KEY) !== serialized) {
      return { saved: false, reason: "storage-unavailable" };
    }
    return { saved: true, next };
  } catch {
    return { saved: false, reason: "storage-unavailable" };
  }
}
