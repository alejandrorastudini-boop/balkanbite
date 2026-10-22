import type { ShoppingItem } from "../types";
import type { GuestPantryStorage } from "./guestPantry";
import { hasPendingGuestMutationJournal } from "./guestJournalExclusivity";
import { guestShoppingCacheIsComplete } from "./guestDerivedShoppingRecovery";
import { isStoredShoppingItemStructurallyValid, parseStoredShoppingCache } from "./storedShoppingValidation";

const KEY = "balkanbite_shopping";
export type GuestShoppingAddCommit =
  | { saved: true; next: ShoppingItem[] }
  | { saved: false; reason: "invalid-view" | "invalid-item" | "duplicate-id" |
    "incomplete" | "stale-snapshot" | "journal-pending" | "storage-unavailable" };

/** Preserve raw user data and require confirmed persistence before displaying
 * an added item. localStorage readback is NOT cross-tab atomic CAS.
 */
export function commitVerifiedGuestShoppingAdd(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
  item: ShoppingItem,
): GuestShoppingAddCommit {
  if (!Array.isArray(visible) ||
      !visible.every(isStoredShoppingItemStructurallyValid) ||
      new Set(visible.map(row => row.id)).size !== visible.length) {
    return { saved: false, reason: "invalid-view" };
  }
  if (!isStoredShoppingItemStructurallyValid(item) || item.checked ||
      item.purchaseAmountConfirmed !== false || item.amountOrigin !== "user_entered") {
    return { saved: false, reason: "invalid-item" };
  }
  if (visible.some(row => row.id === item.id)) {
    return { saved: false, reason: "duplicate-id" };
  }
  try {
    if (hasPendingGuestMutationJournal(storage)) {
      return { saved: false, reason: "journal-pending" };
    }
    const before = storage.getItem(KEY);
    if (!guestShoppingCacheIsComplete(before)) {
      return { saved: false, reason: "incomplete" };
    }
    const existing = before === null ? [] : parseStoredShoppingCache(before);
    if (!existing || new Set(existing.map(row => row.id)).size !== existing.length ||
        JSON.stringify(existing) !== JSON.stringify(visible)) {
      return { saved: false, reason: "stale-snapshot" };
    }
    if (existing.some(row => row.id === item.id)) {
      return { saved: false, reason: "duplicate-id" };
    }
    const next = [...existing, item];
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
