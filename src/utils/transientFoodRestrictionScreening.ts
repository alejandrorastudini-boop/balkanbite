import { validateFoodRestrictionIntent, getConfirmedRestrictionIds } from "./foodRestrictionIntent";
import { screenRecipeFoodRestrictions, type RecipeFoodRestrictionScreening } from "./foodRestrictionScreening";

export type TransientFoodScreeningResult =
  | { status: "screened"; screening: RecipeFoodRestrictionScreening }
  | { status: "not_screened"; reason: "invalid_intent" | "persistent_intent_not_authorized" | "no_confirmed_restrictions" | "missing_ingredients" };

/**
 * Pure, non-persisting screening boundary. This function neither reads nor writes
 * a profile, nor does it make a recipe safe for consumption.
 *
 * The legacy allergy quarantine must still be enforced independently at
 * recommendation endpoints. This adapter does not override that gate.
 */
export function screenWithTransientFoodRestrictionIntent(
  ingredients: readonly { name?: unknown }[] | undefined,
  untrustedIntent: unknown,
): TransientFoodScreeningResult {
  const parsed = validateFoodRestrictionIntent(untrustedIntent);
  if (parsed.status !== "valid") return { status: "not_screened", reason: "invalid_intent" };
  if (parsed.value.useIntent !== "use_once") {
    return { status: "not_screened", reason: "persistent_intent_not_authorized" };
  }
  const ids = getConfirmedRestrictionIds(parsed.value);
  if (ids.length === 0) return { status: "not_screened", reason: "no_confirmed_restrictions" };
  if (!ingredients || ingredients.length === 0) {
    return { status: "not_screened", reason: "missing_ingredients" };
  }
  return { status: "screened", screening: screenRecipeFoodRestrictions(ingredients, ids) };
}
