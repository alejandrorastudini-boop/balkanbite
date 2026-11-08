import type { PantryItem, Recipe } from "../types";
import {
  GUEST_PANTRY_KEY, inspectGuestPantry, writeGuestPantrySafely,
  type GuestPantryStorage,
} from "./guestPantry";
import {
  hasPendingGuestMutationJournal,
  hasConflictingGuestMutationJournal,
} from "./guestJournalExclusivity";
import { deductRecipeIngredientsFromPantry } from "./pantryConsumption";
import {
  appendProgressionEvents, buildRecipeCookProgressEvent,
  isValidProgressionEvent, isValidProgressionTimestamp,
  type ProgressionLedgerV1,
} from "./progressionLedger";
import { parseStoredRecipeCache } from "./storedRecipeValidation";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";
import { parseStoredShoppingCache } from "./storedShoppingValidation";

export const GUEST_COOK_INTENT_KEY = "balkanbite_guest_cook_intent_v1";
const PROGRESSION = "balkanbite_progression";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const SHOPPING = "balkanbite_shopping";

export interface CookIntentStorage extends GuestPantryStorage {
  removeItem(key: string): void;
}

interface CookIntentV1 {
  version: 1;
  cookConfirmationId: string;
  recipeId: string;
  occurredAt: string;
  pantryBefore: string;
  pantryAfter: string;
  progressionBefore: string;
  progressionAfter: string;
  recipesBefore: string;
  planBefore: string;
  shoppingBefore: string;
}
type CookSnapshots = Pick<CookIntentV1,
  "pantryBefore" | "progressionBefore" | "recipesBefore" | "planBefore" | "shoppingBefore">;

export type GuestCookWrite =
  | { status: "saved" | "saved-pending-cleanup" | "already-applied" }
  | { status: "blocked"; reason:
      "invalid-source" | "invalid-confirmation" | "unresolved-intent" |
      "stale-snapshot" | "storage-unavailable" | "pantry-write-failed" |
      "progression-write-failed" };

export type GuestCookRecovery =
  | { status: "none" | "unapplied" | "already-complete" | "progression-replayed" }
  | { status: "blocked"; reason: "invalid-intent" | "conflict" | "storage-unavailable" };

function completeArray<T>(raw: string, parser: (raw: string) => T[] | null): T[] | null {
  try {
    const source: unknown = JSON.parse(raw);
    if (!Array.isArray(source)) return null;
    const result = parser(raw);
    return result && result.length === source.length ? result : null;
  } catch { return null; }
}
function completePantry(raw: string): PantryItem[] | null {
  return completeArray(raw, value => {
    const inspected = inspectGuestPantry(value);
    return inspected.requiresRecovery ? null : inspected.items;
  });
}
function completeRecipes(raw: string): Recipe[] | null {
  const recipes = completeArray(raw, parseStoredRecipeCache);
  return recipes && new Set(recipes.map(r => r.id)).size === recipes.length ? recipes : null;
}
function completeProgression(raw: string): ProgressionLedgerV1 | null {
  return completeArray(raw, value => {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed) || !parsed.every(isValidProgressionEvent)) return null;
      const canonical = appendProgressionEvents([], parsed);
      return canonical.ledger.length === parsed.length &&
        JSON.stringify(canonical.ledger) === JSON.stringify(parsed)
        ? canonical.ledger : null;
    } catch { return null; }
  });
}
function completeOther(raw: string, parse: (value: string) => unknown[] | null): boolean {
  return completeArray(raw, parse) !== null;
}
const validId = (s: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(s);

function prepareCook(
  source: CookSnapshots, command: {
    cookConfirmationId: string; recipeId: string; occurredAt: string;
  },
): CookIntentV1 | null {
  if (!validId(command.cookConfirmationId) || !validId(command.recipeId) ||
      !isValidProgressionTimestamp(command.occurredAt)) return null;
  const pantry = completePantry(source.pantryBefore);
  const progression = completeProgression(source.progressionBefore);
  const recipes = completeRecipes(source.recipesBefore);
  if (!pantry || !progression || !recipes ||
      !completeOther(source.planBefore, parseStoredMealPlanCache) ||
      !completeOther(source.shoppingBefore, parseStoredShoppingCache)) return null;
  const recipe = recipes.find(r => r.id === command.recipeId);
  if (!recipe) return null;
  // A repeated confirmation must never consume stock a second time.
  if (progression.some(event => event.eventId === `cook:${command.cookConfirmationId}`)) return null;
  const result = deductRecipeIngredientsFromPantry(
    pantry, recipe.ingredients, new Date(command.occurredAt),
  );
  if (result.issues.length || result.deductions.length === 0 ||
      !completePantry(JSON.stringify(result.pantry))) return null;
  const event = buildRecipeCookProgressEvent({
    actionId: command.cookConfirmationId, occurredAt: command.occurredAt, result,
  });
  if (!event) return null;
  const next = appendProgressionEvents(progression, [event]);
  if (next.addedEventIds.length !== 1) return null;
  return {
    version: 1,
    cookConfirmationId: command.cookConfirmationId,
    recipeId: command.recipeId,
    occurredAt: command.occurredAt,
    ...source,
    pantryAfter: JSON.stringify(result.pantry),
    progressionAfter: JSON.stringify(next.ledger),
  };
}

function validIntent(raw: string): CookIntentV1 | null {
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    const obj = decoded as Record<string, unknown>;
    const keys = [
      "version", "cookConfirmationId", "recipeId", "occurredAt",
      "pantryBefore", "pantryAfter", "progressionBefore", "progressionAfter",
      "recipesBefore", "planBefore", "shoppingBefore",
    ];
    if (Object.keys(obj).length !== keys.length ||
        keys.some(k => !(k in obj)) || obj.version !== 1 ||
        keys.slice(1).some(k => typeof obj[k] !== "string")) return null;
    const intent = decoded as CookIntentV1;
    const recomputed = prepareCook(intent, intent);
    return recomputed && JSON.stringify(recomputed) === raw ? intent : null;
  } catch { return null; }
}
function stableSources(storage: CookIntentStorage, j: CookIntentV1): boolean {
  return storage.getItem(RECIPES) === j.recipesBefore &&
    storage.getItem(PLAN) === j.planBefore &&
    storage.getItem(SHOPPING) === j.shoppingBefore;
}
function finish(storage: CookIntentStorage, raw: string): boolean {
  if (storage.getItem(GUEST_COOK_INTENT_KEY) !== raw) return false;
  storage.removeItem(GUEST_COOK_INTENT_KEY);
  return storage.getItem(GUEST_COOK_INTENT_KEY) === null;
}

/**
 * Local-only intent. Never treats an LLM inference as evidence. It uses the
 * stored recipe, confirmed stock and stable UI confirmation ID, with exact
 * readback for each write. There is no atomic cross-tab CAS in localStorage.
 */
export function commitConfirmedGuestCookIntent(
  storage: CookIntentStorage,
  command: {
    cookConfirmationId: string; recipeId: string; occurredAt: string;
    expectedPantry: readonly PantryItem[];
    expectedProgression: ProgressionLedgerV1;
    expectedIngredients: Recipe["ingredients"];
  },
): GuestCookWrite {
  if (!validId(command.cookConfirmationId) || !validId(command.recipeId)) {
    return { status: "blocked", reason: "invalid-confirmation" };
  }
  try {
    if (hasPendingGuestMutationJournal(storage)) {
      return { status: "blocked", reason: "unresolved-intent" };
    }
    const keys = [GUEST_PANTRY_KEY, PROGRESSION, RECIPES, PLAN, SHOPPING];
    const rawValues = keys.map(key => storage.getItem(key));
    if (rawValues.some(v => v === null)) return { status: "blocked", reason: "invalid-source" };
    const [pantryBefore, progressionBefore, recipesBefore, planBefore, shoppingBefore] =
      rawValues as string[];
    const snapshots: CookSnapshots = {
      pantryBefore, progressionBefore, recipesBefore, planBefore, shoppingBefore,
    };
    const persistedPantry = completePantry(pantryBefore);
    const persistedProgression = completeProgression(progressionBefore);
    const recipes = completeRecipes(recipesBefore);
    if (!persistedPantry || !persistedProgression || !recipes) {
      return { status: "blocked", reason: "invalid-source" };
    }
    if (JSON.stringify(persistedPantry) !== JSON.stringify(command.expectedPantry) ||
        JSON.stringify(persistedProgression) !== JSON.stringify(command.expectedProgression)) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    const persistedRecipe = recipes.find(r => r.id === command.recipeId);
    if (!persistedRecipe ||
        JSON.stringify(persistedRecipe.ingredients) !== JSON.stringify(command.expectedIngredients)) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    if (persistedProgression.some(e => e.eventId === `cook:${command.cookConfirmationId}`)) {
      return { status: "already-applied" };
    }
    const intent = prepareCook(snapshots, command);
    if (!intent) return { status: "blocked", reason: "invalid-source" };
    const raw = JSON.stringify(intent);
    storage.setItem(GUEST_COOK_INTENT_KEY, raw);
    if (storage.getItem(GUEST_COOK_INTENT_KEY) !== raw) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    const write = writeGuestPantrySafely(storage,
      JSON.parse(intent.pantryAfter) as PantryItem[], command.expectedPantry);
    if (!write.saved) return { status: "blocked", reason: "pantry-write-failed" };
    if (!stableSources(storage, intent) ||
        storage.getItem(PROGRESSION) !== intent.progressionBefore ||
        storage.getItem(GUEST_COOK_INTENT_KEY) !== raw) {
      return { status: "blocked", reason: "stale-snapshot" };
    }
    storage.setItem(PROGRESSION, intent.progressionAfter);
    if (storage.getItem(PROGRESSION) !== intent.progressionAfter) {
      return { status: "blocked", reason: "progression-write-failed" };
    }
    return finish(storage, raw)
      ? { status: "saved" } : { status: "saved-pending-cleanup" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}

/** Recovery never executes another deduction: only progression may be replayed. */
export function recoverConfirmedGuestCookIntent(
  storage: CookIntentStorage,
): GuestCookRecovery {
  try {
    const raw = storage.getItem(GUEST_COOK_INTENT_KEY);
    if (raw === null) return { status: "none" };
    const j = validIntent(raw);
    if (!j) return { status: "blocked", reason: "invalid-intent" };
    if (hasConflictingGuestMutationJournal(storage, GUEST_COOK_INTENT_KEY) ||
        !stableSources(storage, j)) {
      return { status: "blocked", reason: "conflict" };
    }
    const stock = storage.getItem(GUEST_PANTRY_KEY);
    const ledger = storage.getItem(PROGRESSION);
    if (stock === j.pantryBefore && ledger === j.progressionBefore) {
      return finish(storage, raw)
        ? { status: "unapplied" } : { status: "blocked", reason: "storage-unavailable" };
    }
    if (stock !== j.pantryAfter ||
        (ledger !== j.progressionBefore && ledger !== j.progressionAfter)) {
      return { status: "blocked", reason: "conflict" };
    }
    if (ledger === j.progressionAfter) {
      return finish(storage, raw)
        ? { status: "already-complete" } : { status: "blocked", reason: "storage-unavailable" };
    }
    if (storage.getItem(GUEST_PANTRY_KEY) !== j.pantryAfter ||
        storage.getItem(PROGRESSION) !== j.progressionBefore ||
        !stableSources(storage, j) || storage.getItem(GUEST_COOK_INTENT_KEY) !== raw) {
      return { status: "blocked", reason: "conflict" };
    }
    storage.setItem(PROGRESSION, j.progressionAfter);
    if (storage.getItem(PROGRESSION) !== j.progressionAfter) {
      return { status: "blocked", reason: "storage-unavailable" };
    }
    return finish(storage, raw)
      ? { status: "progression-replayed" } : { status: "blocked", reason: "storage-unavailable" };
  } catch { return { status: "blocked", reason: "storage-unavailable" }; }
}
