import type { GuestPantryStorage } from "./guestPantry";

/**
 * Stable localStorage markers for the mutually exclusive guest mutation WALs.
 * This is a best-effort preflight gate, not an atomic cross-tab mutex.
 * Keep the list in sync with boot-time recovery before adding a new journal.
 */
export const GUEST_MUTATION_JOURNAL_KEYS = [
  "balkanbite_guest_pantry_shopping_journal_v1",
  "balkanbite_guest_purchase_intent_v1",
  "balkanbite_guest_cook_intent_v1",
  "balkanbite_guest_cook_derived_intent_v1",
] as const;

export function hasPendingGuestMutationJournal(
  storage: GuestPantryStorage,
): boolean {
  return GUEST_MUTATION_JOURNAL_KEYS.some(key => storage.getItem(key) !== null);
}

export function hasConflictingGuestMutationJournal(
  storage: GuestPantryStorage,
  ownKey: string,
): boolean {
  return GUEST_MUTATION_JOURNAL_KEYS.some(key =>
    key !== ownKey && storage.getItem(key) !== null);
}
