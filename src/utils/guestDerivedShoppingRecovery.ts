import type { Language, ShoppingItem } from "../types";
import { GUEST_PANTRY_KEY, inspectGuestPantry, type GuestPantryStorage } from "./guestPantry";
import { parseStoredMealPlanCache } from "./storedMealPlanValidation";
import { parseStoredShoppingCache } from "./storedShoppingValidation";
import { evaluateShoppingNeeds } from "./shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "./derivedShortageShopping";

const SHOPPING_KEY = "balkanbite_shopping";
const MEAL_PLAN_KEY = "balkanbite_mealplan";

export type GuestDerivedShoppingRecoveryResult =
  | { status: "unchanged" }
  | { status: "repaired"; shopping: ShoppingItem[] }
  | { status: "blocked" };

/** A structural parser must not silently discard legacy rows before an automatic rewrite. */
function completeStoredArray(raw: string, acceptedLength: number): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === acceptedLength;
  } catch {
    return false;
  }
}

/**
 * A guest shopping cache must never be replaced by the parsed subset of
 * malformed historical rows. Preserve original bytes until recovery is
 * explicitly supported. Null (never saved) is a valid new-guest state.
 */
export function guestShoppingCacheIsComplete(raw: string | null): boolean {
  if (raw === null) return true;
  const parsed = parseStoredShoppingCache(raw);
  return parsed !== null && completeStoredArray(raw, parsed.length);
}

/**
 * Reconcile ONLY app-managed shortage rows after guest hydration.
 *
 * This is a deterministic, best-effort recovery for an interrupted derived
 * shopping write. It is not a transaction across localStorage keys.
 * Absent/incomplete sources never justify inventing stock or deleting rows.
 */
export function repairGuestDerivedShoppingOnHydration(
  storage: GuestPantryStorage,
  language: Language,
): GuestDerivedShoppingRecoveryResult {
  try {
    const pantryRaw = storage.getItem(GUEST_PANTRY_KEY);
    const shoppingRaw = storage.getItem(SHOPPING_KEY);
    const mealPlanRaw = storage.getItem(MEAL_PLAN_KEY);
    if (pantryRaw === null || shoppingRaw === null || mealPlanRaw === null) {
      return { status: "unchanged" };
    }

    const inspected = inspectGuestPantry(pantryRaw);
    if (inspected.requiresRecovery) return { status: "unchanged" };

    const savedPlan = parseStoredMealPlanCache(mealPlanRaw);
    const savedShopping = parseStoredShoppingCache(shoppingRaw);
    if (!savedPlan || !savedShopping ||
        !completeStoredArray(mealPlanRaw, savedPlan.length) ||
        !completeStoredArray(shoppingRaw, savedShopping.length)) {
      // Do not replace a malformed/partially filtered cache automatically.
      return { status: "blocked" };
    }

    const candidates = evaluateShoppingNeeds(
      inspected.items, savedPlan, savedShopping, language,
    ).itemsToAddToShoppingList;
    const outcome = reconcileDerivedShortageShoppingItems(savedShopping, candidates);
    if (!outcome.changed) return { status: "unchanged" };

    // A different tab/session may have changed any of the three input keys.
    // This check narrows the race, but cannot provide atomic cross-tab CAS.
    if (storage.getItem(GUEST_PANTRY_KEY) !== pantryRaw ||
        storage.getItem(SHOPPING_KEY) !== shoppingRaw ||
        storage.getItem(MEAL_PLAN_KEY) !== mealPlanRaw) {
      return { status: "blocked" };
    }
    const next = JSON.stringify(outcome.next);
    storage.setItem(SHOPPING_KEY, next);
    if (storage.getItem(SHOPPING_KEY) !== next) {
      return { status: "blocked" };
    }
    return { status: "repaired", shopping: outcome.next };
  } catch {
    return { status: "blocked" };
  }
}
