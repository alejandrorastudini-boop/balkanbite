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
  return commitVerifiedGuestShoppingBatch(storage, visible, [item], "append");
}

/**
 * The verified single-key boundary also handles groups of confirmed
 * reviewable shopping rows. It never acknowledges a partially saved batch.
 * This is best-effort and does NOT make localStorage atomic across tabs.
 */
export function commitVerifiedGuestShoppingBatch(
  storage: GuestPantryStorage,
  visible: readonly ShoppingItem[],
  items: readonly ShoppingItem[],
  placement: "append" | "prepend" = "append",
): GuestShoppingAddCommit {
  if (!Array.isArray(visible) || !visible.every(isStoredShoppingItemStructurallyValid) ||
      new Set(visible.map(row => row.id)).size !== visible.length) {
    return { saved: false, reason: "invalid-view" };
  }
  if (!Array.isArray(items) || items.length === 0 ||
      !items.every(row =>
        isStoredShoppingItemStructurallyValid(row) &&
        row.checked === false && row.purchaseAmountConfirmed === false &&
        (row.amountOrigin === "user_entered" ||
         row.amountOrigin === "deterministic_shortfall" ||
         row.amountOrigin === "ai_estimated")
      )) {
    return { saved: false, reason: "invalid-item" };
  }
  if (new Set(items.map(row => row.id)).size !== items.length ||
      items.some(item => visible.some(row => row.id === item.id))) {
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
    if (items.some(item => existing.some(row => row.id === item.id))) {
      return { saved: false, reason: "duplicate-id" };
    }
    const next = placement === "prepend"
      ? [...items, ...existing] : [...existing, ...items];
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
