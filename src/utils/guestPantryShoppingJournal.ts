import type { PantryItem, ShoppingItem } from "../types";
import {
  GUEST_PANTRY_KEY,
  inspectGuestPantry,
  writeGuestPantrySafely,
  type GuestPantryStorage,
} from "./guestPantry";
import { isManagedDerivedShortageRow } from "./derivedShortageShopping";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";
import { parseStoredShoppingCache } from "./storedShoppingValidation";

export const GUEST_PANTRY_SHOPPING_JOURNAL_KEY =
  "balkanbite_guest_pantry_shopping_journal_v1";
const SHOPPING_KEY = "balkanbite_shopping";
const PLAN_KEY = "balkanbite_mealplan";

/** Removal is only required to finalize the marker, never to erase user data. */
export interface GuestJournalStorage extends GuestPantryStorage {
  removeItem(key: string): void;
}

interface JournalV1 {
  version: 1;
  operationId: string;
  pantryBefore: string;
  pantryAfter: string;
  shoppingBefore: string;
  shoppingAfter: string;
  mealPlanBefore: string;
}

export interface GuestPantryShoppingWrite {
  operationId: string;
  expectedPantry: readonly PantryItem[];
  nextPantry: readonly PantryItem[];
  expectedShopping: readonly ShoppingItem[];
  nextShopping: readonly ShoppingItem[];
}

export type GuestJournalWriteResult =
  | { status: "saved" }
  | { status: "saved-pending-cleanup" }
  | { status: "blocked"; reason: "unresolved-journal" | "invalid-input" | "stale-snapshot" | "storage-unavailable" | "pantry-write-failed" | "shopping-write-failed" };

export type GuestJournalRecoveryResult =
  | { status: "none" | "unapplied" | "already-complete" | "shopping-replayed" }
  | { status: "blocked"; reason: "invalid-journal" | "conflict" | "storage-unavailable" };

function completePantry(raw: string): PantryItem[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const inspected = inspectGuestPantry(raw);
  return inspected.requiresRecovery || inspected.items.length !== parsed.length
    ? null : inspected.items;
}

function completeShopping(raw: string): ShoppingItem[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const valid = parseStoredShoppingCache(raw);
  if (!valid || valid.length !== parsed.length ||
      new Set(valid.map(item => item.id)).size !== valid.length) return null;
  return valid;
}

function completePlan(raw: string): boolean {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return false; }
  if (!Array.isArray(parsed)) return false;
  const valid = parseStoredMealPlanCache(raw);
  return valid !== null && valid.length === parsed.length;
}

function serializedValidPantry(items: readonly PantryItem[]): string | null {
  if (!Array.isArray(items)) return null;
  try {
    const raw = JSON.stringify(items);
    const valid = completePantry(raw);
    return valid && valid.length === items.length ? raw : null;
  } catch { return null; }
}

function serializedValidShopping(items: readonly ShoppingItem[]): string | null {
  if (!Array.isArray(items)) return null;
  try {
    const raw = JSON.stringify(items);
    const valid = completeShopping(raw);
    return valid && valid.length === items.length ? raw : null;
  } catch { return null; }
}

function manualShoppingUnchanged(before: readonly ShoppingItem[], after: readonly ShoppingItem[]): boolean {
  const userOwned = (rows: readonly ShoppingItem[]) =>
    rows.filter(item => !isManagedDerivedShortageRow(item));
  return JSON.stringify(userOwned(before)) === JSON.stringify(userOwned(after));
}

function validJournal(value: unknown): value is JournalV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const j = value as Record<string, unknown>;
  const keys = ["version", "operationId", "pantryBefore", "pantryAfter",
    "shoppingBefore", "shoppingAfter", "mealPlanBefore"];
  if (Object.keys(j).length !== keys.length || keys.some(k => !(k in j)) ||
      j.version !== 1 ||
      typeof j.operationId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(j.operationId) ||
      typeof j.pantryBefore !== "string" || typeof j.pantryAfter !== "string" ||
      typeof j.shoppingBefore !== "string" || typeof j.shoppingAfter !== "string" ||
      typeof j.mealPlanBefore !== "string") return false;
  const beforePantry = completePantry(j.pantryBefore);
  const afterPantry = completePantry(j.pantryAfter);
  const beforeShopping = completeShopping(j.shoppingBefore);
  const afterShopping = completeShopping(j.shoppingAfter);
  return beforePantry !== null && afterPantry !== null &&
    beforeShopping !== null && afterShopping !== null &&
    completePlan(j.mealPlanBefore) &&
    manualShoppingUnchanged(beforeShopping, afterShopping) &&
    j.pantryBefore !== j.pantryAfter;
}

function finishJournal(storage: GuestJournalStorage, expectedRaw: string): boolean {
  if (storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== expectedRaw) return false;
  storage.removeItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY);
  return storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) === null;
}

/**
 * Write-ahead, readback-verified guest pantry+derived-shopping operation.
 * The caller must provide an explicit, deterministic next shopping state;
 * this helper NEVER invents amounts, replays a purchase or re-runs consumption.
 *
 * This is recoverable after reload, NOT an atomic multi-tab transaction.
 * It must not be wired into App before the caller and QA for current
 * recipes/meal-plan/shopping snapshots have been validated.
 */
export function writeGuestPantryShoppingWithJournal(
  storage: GuestJournalStorage,
  write: GuestPantryShoppingWrite,
): GuestJournalWriteResult {
  const afterPantry = serializedValidPantry(write.nextPantry);
  const beforePantry = serializedValidPantry(write.expectedPantry);
  const beforeShopping = serializedValidShopping(write.expectedShopping);
  const afterShopping = serializedValidShopping(write.nextShopping);
  if (!afterPantry || !beforePantry || !beforeShopping || !afterShopping ||
      !manualShoppingUnchanged(write.expectedShopping, write.nextShopping) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(write.operationId) ||
      beforePantry === afterPantry) return { status: "blocked", reason: "invalid-input" };

  try {
    if (storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== null) {
      return { status: "blocked", reason: "unresolved-journal" };
    }
    const pantryBeforeRaw = storage.getItem(GUEST_PANTRY_KEY);
    const shoppingBeforeRaw = storage.getItem(SHOPPING_KEY);
    const mealPlanRaw = storage.getItem(PLAN_KEY);
    if (pantryBeforeRaw === null || shoppingBeforeRaw === null || mealPlanRaw === null ||
        !completePlan(mealPlanRaw) || completePantry(pantryBeforeRaw) === null ||
        completeShopping(shoppingBeforeRaw) === null) {
      return { status: "blocked", reason: "invalid-input" };
    }
    // Reject stale React snapshots even if stored JSON has harmless whitespace.
    if (JSON.stringify(completePantry(pantryBeforeRaw)) !== beforePantry ||
        JSON.stringify(completeShopping(shoppingBeforeRaw)) !== beforeShopping) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    const journal: JournalV1 = {
      version: 1,
      operationId: write.operationId,
      pantryBefore: pantryBeforeRaw,
      pantryAfter: afterPantry,
      shoppingBefore: shoppingBeforeRaw,
      shoppingAfter: afterShopping,
      mealPlanBefore: mealPlanRaw,
    };
    const raw = JSON.stringify(journal);
    storage.setItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY, raw);
    if (storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== raw) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    // Preserve the pre-existing quarantine and stale-snapshot protection.
    const pantryResult = writeGuestPantrySafely(storage, write.nextPantry, write.expectedPantry);
    if (!pantryResult.saved) return { status: "blocked", reason: "pantry-write-failed" };

    // A contemporaneous meal-plan/shopping change cannot silently disappear.
    if (storage.getItem(PLAN_KEY) !== mealPlanRaw ||
        storage.getItem(SHOPPING_KEY) !== shoppingBeforeRaw) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    storage.setItem(SHOPPING_KEY, afterShopping);
    if (storage.getItem(SHOPPING_KEY) !== afterShopping) {
      return { status: "blocked", reason: "shopping-write-failed" };
    }
    return finishJournal(storage, raw)
      ? { status: "saved" } : { status: "saved-pending-cleanup" };
  } catch {
    // If a later step failed, the intact journal is necessary to recover it.
    return { status: "blocked", reason: "storage-unavailable" };
  }
}

/**
 * Recovery does not run the pantry mutation again. It only repairs the
 * shopping projection when pantry bytes ALREADY show the after-state.
 * A pending intent with unchanged pantry is dropped, not executed.
 * Any unexpected source revision fails closed without overwriting a row.
 */
export function recoverGuestPantryShoppingJournal(
  storage: GuestJournalStorage,
): GuestJournalRecoveryResult {
  try {
    const raw = storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY);
    if (raw === null) return { status: "none" };
    let journal: unknown;
    try { journal = JSON.parse(raw); } catch {
      return { status: "blocked", reason: "invalid-journal" };
    }
    if (!validJournal(journal)) {
      return { status: "blocked", reason: "invalid-journal" };
    }

    if (storage.getItem(PLAN_KEY) !== journal.mealPlanBefore) {
      return { status: "blocked", reason: "conflict" };
    }
    const currentPantry = storage.getItem(GUEST_PANTRY_KEY);
    const currentShopping = storage.getItem(SHOPPING_KEY);
    if (currentPantry === journal.pantryBefore &&
        currentShopping === journal.shoppingBefore) {
      return finishJournal(storage, raw)
        ? { status: "unapplied" }
        : { status: "blocked", reason: "storage-unavailable" };
    }
    if (currentPantry !== journal.pantryAfter ||
        (currentShopping !== journal.shoppingBefore &&
         currentShopping !== journal.shoppingAfter)) {
      return { status: "blocked", reason: "conflict" };
    }
    if (currentShopping === journal.shoppingAfter) {
      return finishJournal(storage, raw)
        ? { status: "already-complete" }
        : { status: "blocked", reason: "storage-unavailable" };
    }

    // Before attempting a replay, confirm nothing changed behind our back.
    if (storage.getItem(GUEST_PANTRY_KEY) !== journal.pantryAfter ||
        storage.getItem(SHOPPING_KEY) !== journal.shoppingBefore ||
        storage.getItem(PLAN_KEY) !== journal.mealPlanBefore ||
        storage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== raw) {
      return { status: "blocked", reason: "conflict" };
    }
    storage.setItem(SHOPPING_KEY, journal.shoppingAfter);
    if (storage.getItem(SHOPPING_KEY) !== journal.shoppingAfter) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    return finishJournal(storage, raw)
      ? { status: "shopping-replayed" }
      : { status: "blocked", reason: "storage-unavailable" };
  } catch {
    return { status: "blocked", reason: "storage-unavailable" };
  }
}
