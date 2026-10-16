import type { PantryItem, ShoppingItem } from "../types";
import {
  GUEST_PANTRY_KEY,
  inspectGuestPantry,
  writeGuestPantrySafely,
} from "./guestPantry";
import type { GuestJournalStorage } from "./guestPantryShoppingJournal";
import {
  hasPendingGuestMutationJournal,
  hasConflictingGuestMutationJournal,
} from "./guestJournalExclusivity";
import { transferCheckedShoppingItems } from "./purchasePantryMerge";
import {
  appendProgressionEvents,
  buildPurchaseProgressEvents,
  isValidProgressionEvent,
  isValidProgressionTimestamp,
  type ProgressionLedgerV1,
} from "./progressionLedger";
import { parseStoredShoppingCache } from "./storedShoppingValidation";
import { parseStoredRecipeCache } from "./storedRecipeValidation";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";

export const GUEST_PURCHASE_INTENT_KEY = "balkanbite_guest_purchase_intent_v1";
const SHOPPING_KEY = "balkanbite_shopping";
const PROGRESSION_KEY = "balkanbite_progression";
const RECIPES_KEY = "balkanbite_recipes";
const PLAN_KEY = "balkanbite_mealplan";

interface GuestPurchaseIntentV1 {
  version: 1;
  operationId: string;
  occurredAt: string;
  acquiredAt: string;
  pantryBefore: string;
  shoppingBefore: string;
  progressionBefore: string;
  pantryAfter: string;
  shoppingAfter: string;
  progressionAfter: string;
  recipesBefore: string;
  planBefore: string;
}
type SourceSnapshots = Pick<GuestPurchaseIntentV1,
  "pantryBefore" | "shoppingBefore" | "progressionBefore" | "recipesBefore" | "planBefore">;
type Result =
  | { status: "saved" | "saved-pending-cleanup" }
  | { status: "blocked"; reason: "invalid-source" | "stale-snapshot" | "no-new-confirmed-purchases" |
      "unresolved-intent" | "storage-unavailable" | "conflict" };

export type GuestPurchaseRecovery =
  | { status: "none" | "unapplied" | "already-complete" | "completed-derived-writes" }
  | { status: "blocked"; reason: "invalid-intent" | "conflict" | "storage-unavailable" };

function readCompleteArray<T>(raw: string, parser: (text: string) => T[] | null): T[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parser(raw);
    return valid && valid.length === parsed.length ? valid : null;
  } catch {
    return null;
  }
}

function completePantry(raw: string): PantryItem[] | null {
  return readCompleteArray(raw, text => {
    const inspected = inspectGuestPantry(text);
    return inspected.requiresRecovery ? null : inspected.items;
  });
}
function completeShopping(raw: string): ShoppingItem[] | null {
  const rows = readCompleteArray(raw, parseStoredShoppingCache);
  return rows && new Set(rows.map(row => row.id)).size === rows.length ? rows : null;
}
function completeProgression(raw: string): ProgressionLedgerV1 | null {
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!Array.isArray(decoded) || !decoded.every(isValidProgressionEvent)) return null;
    const canonical = appendProgressionEvents([], decoded);
    if (canonical.ledger.length !== decoded.length ||
        JSON.stringify(canonical.ledger) !== JSON.stringify(decoded)) return null;
    return canonical.ledger;
  } catch {
    return null;
  }
}
function completeOther(raw: string, parser: (text: string) => unknown[] | null): boolean {
  return readCompleteArray(raw, parser) !== null;
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validOperationId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id);
}

/**
 * Deterministically prepare a fully confirmed shopping transfer, including
 * only idempotent purchase evidence based on NEWLY applied source IDs.
 * No model-inferred quantities, prices, costs, or expiry are introduced here.
 *
 * This is a three-key LOCAL recovery contract, not an atomic browser CAS.
 * Do not call from the App until boot/hydration writers for ALL three keys are
 * held behind a review/recovery gate and Chromium tests pass.
 */
function prepare(snapshots: SourceSnapshots, command: {
  operationId: string; acquiredAt: string; occurredAt: string;
}): GuestPurchaseIntentV1 | null {
  if (!validOperationId(command.operationId) ||
      !isValidProgressionTimestamp(command.occurredAt) ||
      !validDate(command.acquiredAt) ||
      !completeOther(snapshots.recipesBefore, parseStoredRecipeCache) ||
      !completeOther(snapshots.planBefore, parseStoredMealPlanCache)) return null;
  const pantry = completePantry(snapshots.pantryBefore);
  const shopping = completeShopping(snapshots.shoppingBefore);
  const progression = completeProgression(snapshots.progressionBefore);
  if (!pantry || !shopping || !progression) return null;

  const transfer = transferCheckedShoppingItems(pantry, shopping, command.acquiredAt);
  if (transfer.rejected.length > 0 || transfer.newlyAppliedSourceIds.length === 0 ||
      transfer.newlyAppliedSourceIds.length !== transfer.acceptedSourceIds.length ||
      transfer.shoppingList.length >= shopping.length ||
      !completePantry(JSON.stringify(transfer.pantry)) ||
      !completeShopping(JSON.stringify(transfer.shoppingList))) return null;
  const events = buildPurchaseProgressEvents({
    occurredAt: command.occurredAt,
    newlyAppliedSourceIds: transfer.newlyAppliedSourceIds,
  });
  if (events.length !== transfer.newlyAppliedSourceIds.length ||
      events.some(event => progression.some(existing => existing.eventId === event.eventId))) return null;
  const appended = appendProgressionEvents(progression, events);
  if (appended.addedEventIds.length !== events.length) return null;

  return {
    version: 1,
    operationId: command.operationId,
    acquiredAt: command.acquiredAt,
    occurredAt: command.occurredAt,
    ...snapshots,
    pantryAfter: JSON.stringify(transfer.pantry),
    shoppingAfter: JSON.stringify(transfer.shoppingList),
    progressionAfter: JSON.stringify(appended.ledger),
  };
}

function validIntent(raw: string): GuestPurchaseIntentV1 | null {
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    const record = decoded as Record<string, unknown>;
    const keys = [
      "version", "operationId", "occurredAt", "acquiredAt", "pantryBefore",
      "shoppingBefore", "progressionBefore", "pantryAfter", "shoppingAfter",
      "progressionAfter", "recipesBefore", "planBefore",
    ];
    if (Object.keys(record).length !== keys.length ||
        keys.some(k => !(k in record)) || record.version !== 1 ||
        keys.filter(k => k !== "version").some(k => typeof record[k] !== "string")) return null;
    const entry = decoded as GuestPurchaseIntentV1;
    const recomputed = prepare(entry, entry);
    return recomputed && JSON.stringify(recomputed) === raw ? entry : null;
  } catch {
    return null;
  }
}

function unchangedSources(storage: GuestJournalStorage, entry: GuestPurchaseIntentV1): boolean {
  return storage.getItem(RECIPES_KEY) === entry.recipesBefore &&
    storage.getItem(PLAN_KEY) === entry.planBefore;
}
function finish(storage: GuestJournalStorage, raw: string): boolean {
  if (storage.getItem(GUEST_PURCHASE_INTENT_KEY) !== raw) return false;
  storage.removeItem(GUEST_PURCHASE_INTENT_KEY);
  return storage.getItem(GUEST_PURCHASE_INTENT_KEY) === null;
}

export function commitConfirmedGuestPurchaseIntent(
  storage: GuestJournalStorage,
  command: {
    operationId: string; acquiredAt: string; occurredAt: string;
    expectedPantry: readonly PantryItem[];
    expectedShopping: readonly ShoppingItem[];
    expectedProgression: ProgressionLedgerV1;
  },
): Result {
  try {
    if (hasPendingGuestMutationJournal(storage)) {
      return { status: "blocked", reason: "unresolved-intent" };
    }
    const pantryBefore = storage.getItem(GUEST_PANTRY_KEY);
    const shoppingBefore = storage.getItem(SHOPPING_KEY);
    const progressionBefore = storage.getItem(PROGRESSION_KEY);
    const recipesBefore = storage.getItem(RECIPES_KEY);
    const planBefore = storage.getItem(PLAN_KEY);
    if ([pantryBefore, shoppingBefore, progressionBefore, recipesBefore, planBefore]
      .some(value => value === null)) return { status: "blocked", reason: "invalid-source" };
    const snapshots = {
      pantryBefore: pantryBefore!, shoppingBefore: shoppingBefore!,
      progressionBefore: progressionBefore!, recipesBefore: recipesBefore!,
      planBefore: planBefore!,
    };
    if (JSON.stringify(completePantry(snapshots.pantryBefore)) !== JSON.stringify(command.expectedPantry) ||
        JSON.stringify(completeShopping(snapshots.shoppingBefore)) !== JSON.stringify(command.expectedShopping) ||
        JSON.stringify(completeProgression(snapshots.progressionBefore)) !== JSON.stringify(command.expectedProgression)) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    const entry = prepare(snapshots, command);
    if (!entry) return { status: "blocked", reason: "invalid-source" };
    const raw = JSON.stringify(entry);
    storage.setItem(GUEST_PURCHASE_INTENT_KEY, raw);
    if (storage.getItem(GUEST_PURCHASE_INTENT_KEY) !== raw) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    const savedPantry = writeGuestPantrySafely(storage,
      JSON.parse(entry.pantryAfter) as PantryItem[], command.expectedPantry);
    if (!savedPantry.saved) return { status: "blocked", reason: "conflict" };
    if (!unchangedSources(storage, entry) ||
        storage.getItem(SHOPPING_KEY) !== entry.shoppingBefore ||
        storage.getItem(PROGRESSION_KEY) !== entry.progressionBefore) {
      return { status: "blocked", reason: "conflict" };
    }
    storage.setItem(SHOPPING_KEY, entry.shoppingAfter);
    if (storage.getItem(SHOPPING_KEY) !== entry.shoppingAfter) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    storage.setItem(PROGRESSION_KEY, entry.progressionAfter);
    if (storage.getItem(PROGRESSION_KEY) !== entry.progressionAfter) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    return finish(storage, raw)
      ? { status: "saved" } : { status: "saved-pending-cleanup" };
  } catch {
    return { status: "blocked", reason: "storage-unavailable" };
  }
}

/**
 * Never re-runs mergePurchasesIntoPantry; the only replayed keys are shopping
 * and the progress ledger when the exact pantry after-snapshot is ALREADY saved.
 * Any concurrent change or invalid intent is preserved for review.
 */
export function recoverConfirmedGuestPurchaseIntent(
  storage: GuestJournalStorage,
): GuestPurchaseRecovery {
  try {
    const raw = storage.getItem(GUEST_PURCHASE_INTENT_KEY);
    if (raw === null) return { status: "none" };
    const entry = validIntent(raw);
    if (!entry) return { status: "blocked", reason: "invalid-intent" };
    if (hasConflictingGuestMutationJournal(storage, GUEST_PURCHASE_INTENT_KEY) ||
        !unchangedSources(storage, entry)) return { status: "blocked", reason: "conflict" };
    const pantry = storage.getItem(GUEST_PANTRY_KEY);
    const shopping = storage.getItem(SHOPPING_KEY);
    const progression = storage.getItem(PROGRESSION_KEY);
    if (pantry === entry.pantryBefore &&
        shopping === entry.shoppingBefore &&
        progression === entry.progressionBefore) {
      return finish(storage, raw)
        ? { status: "unapplied" } : { status: "blocked", reason: "storage-unavailable" };
    }
    if (pantry !== entry.pantryAfter ||
        (shopping !== entry.shoppingBefore && shopping !== entry.shoppingAfter) ||
        (progression !== entry.progressionBefore && progression !== entry.progressionAfter) ||
        (shopping === entry.shoppingBefore && progression !== entry.progressionBefore)) {
      return { status: "blocked", reason: "conflict" };
    }
    if (shopping === entry.shoppingAfter && progression === entry.progressionAfter) {
      return finish(storage, raw)
        ? { status: "already-complete" } : { status: "blocked", reason: "storage-unavailable" };
    }
    if (storage.getItem(GUEST_PANTRY_KEY) !== entry.pantryAfter ||
        storage.getItem(SHOPPING_KEY) !== shopping ||
        storage.getItem(PROGRESSION_KEY) !== progression ||
        storage.getItem(GUEST_PURCHASE_INTENT_KEY) !== raw ||
        !unchangedSources(storage, entry)) return { status: "blocked", reason: "conflict" };
    if (shopping === entry.shoppingBefore) {
      storage.setItem(SHOPPING_KEY, entry.shoppingAfter);
      if (storage.getItem(SHOPPING_KEY) !== entry.shoppingAfter) {
        return { status: "blocked", reason: "storage-unavailable" };
      }
    }
    if (storage.getItem(PROGRESSION_KEY) !== entry.progressionAfter) {
      storage.setItem(PROGRESSION_KEY, entry.progressionAfter);
      if (storage.getItem(PROGRESSION_KEY) !== entry.progressionAfter) {
        return { status: "blocked", reason: "storage-unavailable" };
      }
    }
    return finish(storage, raw)
      ? { status: "completed-derived-writes" } : { status: "blocked", reason: "storage-unavailable" };
  } catch {
    return { status: "blocked", reason: "storage-unavailable" };
  }
}
