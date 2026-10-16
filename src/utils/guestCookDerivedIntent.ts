import type { Language, MealPlanDay, PantryItem, Recipe, ShoppingItem } from "../types";
import { GUEST_PANTRY_KEY, inspectGuestPantry, writeGuestPantrySafely } from "./guestPantry";
import type { CookIntentStorage } from "./guestConfirmedCookIntent";
import { GUEST_COOK_INTENT_KEY } from "./guestConfirmedCookIntent";
import { GUEST_PURCHASE_INTENT_KEY } from "./guestConfirmedPurchaseIntent";
import { GUEST_PANTRY_SHOPPING_JOURNAL_KEY } from "./guestPantryShoppingJournal";
import { deductRecipeIngredientsFromPantry } from "./pantryConsumption";
import { syncRecipesWithPantry } from "./menuAutoPlanner";
import { evaluateShoppingNeeds } from "./shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "./derivedShortageShopping";
import {
  appendProgressionEvents, buildRecipeCookProgressEvent,
  isValidProgressionEvent, isValidProgressionTimestamp,
  type ProgressionLedgerV1,
} from "./progressionLedger";
import { parseStoredRecipeCache } from "./storedRecipeValidation";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";
import { parseStoredShoppingCache } from "./storedShoppingValidation";

export const GUEST_COOK_DERIVED_INTENT_KEY = "balkanbite_guest_cook_derived_intent_v1";
const PROGRESSION = "balkanbite_progression";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const SHOPPING = "balkanbite_shopping";
const KEYS = [GUEST_PANTRY_KEY, RECIPES, PLAN, SHOPPING, PROGRESSION] as const;
type FiveKeys = [string, string, string, string, string];

interface DerivedCookIntentV1 {
  version: 1;
  cookConfirmationId: string;
  recipeId: string;
  occurredAt: string;
  language: Language;
  before: FiveKeys;
  after: FiveKeys;
}

export interface DerivedGuestCookCommand {
  cookConfirmationId: string;
  recipeId: string;
  occurredAt: string;
  language: Language;
  expectedPantry: readonly PantryItem[];
  expectedRecipes: readonly Recipe[];
  expectedPlan: readonly MealPlanDay[];
  expectedShopping: readonly ShoppingItem[];
  expectedProgression: ProgressionLedgerV1;
  nextRecipes: readonly Recipe[];
  nextPlan: readonly MealPlanDay[];
  nextShopping: readonly ShoppingItem[];
}

export type GuestDerivedCookWrite =
  | { status: "saved" | "saved-pending-cleanup" | "already-applied" }
  | { status: "blocked"; reason:
    "unresolved-intent" | "invalid-input" | "stale-snapshot" |
    "storage-unavailable" | "pantry-write-failed" | "derived-write-failed" };

export type GuestDerivedCookRecovery =
  | { status: "none" | "unapplied" | "already-complete" | "completed-derived-writes" }
  | { status: "blocked"; reason: "invalid-intent" | "conflict" | "storage-unavailable" };

const validId = (v: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v);
const isLanguage = (v: unknown): v is Language => v === "bg" || v === "en" || v === "es";

function completeArray<T>(
  raw: string,
  parse: (value: string) => T[] | null,
): T[] | null {
  try {
    const original: unknown = JSON.parse(raw);
    if (!Array.isArray(original)) return null;
    const accepted = parse(raw);
    return accepted && accepted.length === original.length ? accepted : null;
  } catch { return null; }
}
function pantry(raw: string): PantryItem[] | null {
  return completeArray(raw, value => {
    const inspected = inspectGuestPantry(value);
    return inspected.requiresRecovery ? null : inspected.items;
  });
}
function recipes(raw: string): Recipe[] | null {
  const items = completeArray(raw, parseStoredRecipeCache);
  return items && new Set(items.map(item => item.id)).size === items.length
    ? items : null;
}
function plan(raw: string): MealPlanDay[] | null {
  return completeArray(raw, parseStoredMealPlanCache);
}
function shopping(raw: string): ShoppingItem[] | null {
  const items = completeArray(raw, parseStoredShoppingCache);
  return items && new Set(items.map(item => item.id)).size === items.length
    ? items : null;
}
function ledger(raw: string): ProgressionLedgerV1 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValidProgressionEvent)) return null;
    const canonical = appendProgressionEvents([], parsed);
    return canonical.ledger.length === parsed.length &&
      JSON.stringify(canonical.ledger) === JSON.stringify(parsed)
      ? canonical.ledger : null;
  } catch { return null; }
}
function validSnapshots(raw: readonly string[]): boolean {
  return raw.length === 5 && pantry(raw[0]) !== null &&
    recipes(raw[1]) !== null && plan(raw[2]) !== null &&
    shopping(raw[3]) !== null && ledger(raw[4]) !== null;
}
function fromCommandExpected(command: DerivedGuestCookCommand): FiveKeys {
  return [
    JSON.stringify(command.expectedPantry),
    JSON.stringify(command.expectedRecipes),
    JSON.stringify(command.expectedPlan),
    JSON.stringify(command.expectedShopping),
    JSON.stringify(command.expectedProgression),
  ];
}
function noOtherPending(storage: CookIntentStorage): boolean {
  return [GUEST_COOK_DERIVED_INTENT_KEY, GUEST_COOK_INTENT_KEY,
    GUEST_PURCHASE_INTENT_KEY, GUEST_PANTRY_SHOPPING_JOURNAL_KEY]
    .every(key => storage.getItem(key) === null);
}

/** Re-evaluate all derivations from the exact snapshotted input; never guess data. */
function derive(
  before: FiveKeys,
  command: Pick<DerivedCookIntentV1,
    "cookConfirmationId" | "recipeId" | "occurredAt" | "language">,
  afterPlan: MealPlanDay[],
): FiveKeys | null {
  if (!validId(command.cookConfirmationId) || !validId(command.recipeId) ||
    !isValidProgressionTimestamp(command.occurredAt) || !isLanguage(command.language) ||
    !validSnapshots(before) || plan(JSON.stringify(afterPlan)) === null) return null;
  const originalPantry = pantry(before[0])!;
  const originalRecipes = recipes(before[1])!;
  const originalShopping = shopping(before[3])!;
  const originalLedger = ledger(before[4])!;
  if (!originalRecipes.some(recipe => recipe.id === command.recipeId) ||
    originalLedger.some(event => event.eventId === `cook:${command.cookConfirmationId}`)) return null;
  const selected = originalRecipes.find(recipe => recipe.id === command.recipeId)!;
  const consumed = deductRecipeIngredientsFromPantry(
    originalPantry, selected.ingredients, new Date(command.occurredAt),
  );
  if (consumed.issues.length > 0 || consumed.deductions.length === 0) return null;
  const progress = buildRecipeCookProgressEvent({
    actionId: command.cookConfirmationId, occurredAt: command.occurredAt,
    result: consumed,
  });
  if (!progress) return null;
  const added = appendProgressionEvents(originalLedger, [progress]);
  if (added.addedEventIds.length !== 1) return null;
  const nextRecipes = syncRecipesWithPantry(
    originalRecipes, consumed.pantry, new Date(command.occurredAt),
  );
  const shortageCandidates = evaluateShoppingNeeds(
    consumed.pantry, afterPlan, originalShopping, command.language,
  ).itemsToAddToShoppingList;
  const nextShopping = reconcileDerivedShortageShoppingItems(
    originalShopping, shortageCandidates,
  ).next;
  const after: FiveKeys = [
    JSON.stringify(consumed.pantry),
    JSON.stringify(nextRecipes),
    JSON.stringify(afterPlan),
    JSON.stringify(nextShopping),
    JSON.stringify(added.ledger),
  ];
  return validSnapshots(after) ? after : null;
}
function completeIntent(raw: string): DerivedCookIntentV1 | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    const keys = ["version", "cookConfirmationId", "recipeId", "occurredAt", "language", "before", "after"];
    if (Object.keys(v).length !== keys.length || keys.some(k => !(k in v)) ||
      v.version !== 1 || typeof v.cookConfirmationId !== "string" ||
      typeof v.recipeId !== "string" || typeof v.occurredAt !== "string" ||
      !isLanguage(v.language) ||
      !Array.isArray(v.before) || !Array.isArray(v.after) ||
      v.before.length !== 5 || v.after.length !== 5 ||
      !v.before.every(x => typeof x === "string") ||
      !v.after.every(x => typeof x === "string")) return null;
    const intent = value as DerivedCookIntentV1;
    const afterPlan = plan(intent.after[2]);
    if (!afterPlan) return null;
    const recalculated = derive(intent.before, intent, afterPlan);
    return recalculated && JSON.stringify(recalculated) === JSON.stringify(intent.after)
      ? intent : null;
  } catch { return null; }
}
function finish(storage: CookIntentStorage, raw: string): boolean {
  if (storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) !== raw) return false;
  storage.removeItem(GUEST_COOK_DERIVED_INTENT_KEY);
  return storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) === null;
}

/**
 * Five-key local WAL, not an atomic multi-tab transaction.
 * Before writing anything, verify both React expectations and fully
 * deterministic stock/recipe/shopping/progression projections.
 * The meal-plan projection comes from the caller's deterministic, safety
 * gated planner and is structurally validated; it is NOT regenerated on replay.
 */
export function commitDerivedGuestCookIntent(
  storage: CookIntentStorage,
  command: DerivedGuestCookCommand,
): GuestDerivedCookWrite {
  try {
    if (!noOtherPending(storage)) {
      return { status: "blocked", reason: "unresolved-intent" };
    }
    const values = KEYS.map(key => storage.getItem(key));
    if (values.some(value => value === null)) {
      return { status: "blocked", reason: "invalid-input" };
    }
    const before = values as FiveKeys;
    if (!validSnapshots(before)) return { status: "blocked", reason: "invalid-input" };
    if (JSON.stringify(before) !== JSON.stringify(fromCommandExpected(command))) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    const existing = ledger(before[4])!;
    if (existing.some(e => e.eventId === `cook:${command.cookConfirmationId}`)) {
      return { status: "already-applied" };
    }
    const after = derive(before, command, [...command.nextPlan]);
    if (!after || after[1] !== JSON.stringify(command.nextRecipes) ||
      after[3] !== JSON.stringify(command.nextShopping)) {
      return { status: "blocked", reason: "invalid-input" };
    }
    const entry: DerivedCookIntentV1 = {
      version: 1,
      cookConfirmationId: command.cookConfirmationId,
      recipeId: command.recipeId,
      occurredAt: command.occurredAt,
      language: command.language,
      before,
      after,
    };
    const raw = JSON.stringify(entry);
    storage.setItem(GUEST_COOK_DERIVED_INTENT_KEY, raw);
    if (storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) !== raw) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    const stockWrite = writeGuestPantrySafely(
      storage, JSON.parse(after[0]) as PantryItem[], command.expectedPantry,
    );
    if (!stockWrite.saved) return { status: "blocked", reason: "pantry-write-failed" };
    for (let i = 1; i < KEYS.length; i++) {
      // Refuse a stale/interleaved write; the staged WAL remains for review.
      if (storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) !== raw ||
        KEYS.some((key, index) => storage.getItem(key) !== (index < i ? after[index] : before[index]))) {
        return { status: "blocked", reason: "stale-snapshot" };
      }
      storage.setItem(KEYS[i], after[i]);
      if (storage.getItem(KEYS[i]) !== after[i]) {
        return { status: "blocked", reason: "derived-write-failed" };
      }
    }
    return finish(storage, raw)
      ? { status: "saved" } : { status: "saved-pending-cleanup" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}

/** Replay *only* stored after-snapshots, never calculate a second deduction. */
export function recoverDerivedGuestCookIntent(
  storage: CookIntentStorage,
): GuestDerivedCookRecovery {
  try {
    const raw = storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY);
    if (raw === null) return { status: "none" };
    const entry = completeIntent(raw);
    if (!entry) return { status: "blocked", reason: "invalid-intent" };
    if ([GUEST_COOK_INTENT_KEY, GUEST_PURCHASE_INTENT_KEY,
      GUEST_PANTRY_SHOPPING_JOURNAL_KEY].some(key => storage.getItem(key) !== null)) {
      return { status: "blocked", reason: "conflict" };
    }
    const current = KEYS.map(key => storage.getItem(key));
    let firstPending = -1;
    for (let index = 0; index < KEYS.length; index++) {
      // No after-state may follow a distinct before-state: that is not a
      // prefix of our durable writes and could be a concurrent tab edit.
      if (current[index] !== entry.before[index] && current[index] !== entry.after[index]) {
        return { status: "blocked", reason: "conflict" };
      }
      if (entry.before[index] === entry.after[index]) continue;
      if (current[index] === entry.before[index]) {
        if (firstPending === -1) firstPending = index;
      } else if (firstPending !== -1) {
        return { status: "blocked", reason: "conflict" };
      }
    }
    if (firstPending === 0) {
      return finish(storage, raw)
        ? { status: "unapplied" } : { status: "blocked", reason: "storage-unavailable" };
    }
    if (firstPending === -1) {
      return finish(storage, raw)
        ? { status: "already-complete" } : { status: "blocked", reason: "storage-unavailable" };
    }
    const expected = [...current];
    for (let i = firstPending; i < KEYS.length; i++) {
      if (storage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) !== raw ||
        KEYS.some((key, index) => storage.getItem(key) !== expected[index])) {
        return { status: "blocked", reason: "conflict" };
      }
      if (expected[i] !== entry.after[i]) {
        storage.setItem(KEYS[i], entry.after[i]);
        if (storage.getItem(KEYS[i]) !== entry.after[i]) {
          return { status: "blocked", reason: "storage-unavailable" };
        }
        expected[i] = entry.after[i];
      }
    }
    return finish(storage, raw)
      ? { status: "completed-derived-writes" } : { status: "blocked", reason: "storage-unavailable" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}
