import { normalizeQuantity } from "./quantityUnits";

export interface CookExpectedRemainingIngredient {
  pantryItemId: unknown;
  quantity: unknown;
  unit: unknown;
}

/**
 * Computes the server-confirmation target in the authoritative pantry unit.
 * Compatible units are normalized deterministically; incompatible or malformed
 * evidence fails closed instead of subtracting raw numbers.
 */
export function computeCookExpectedRemaining(
  pantryItemId: string,
  pantryQuantity: number,
  pantryUnit: string,
  ingredients: readonly CookExpectedRemainingIngredient[],
): number | null {
  const available = normalizeQuantity(pantryQuantity, pantryUnit);
  if (!available || !Array.isArray(ingredients)) return null;

  let consumedBase = 0;
  let matched = false;
  for (const ingredient of ingredients) {
    if (ingredient.pantryItemId !== pantryItemId) continue;
    matched = true;
    if (
      typeof ingredient.quantity !== "number" ||
      !Number.isFinite(ingredient.quantity) ||
      ingredient.quantity <= 0 ||
      typeof ingredient.unit !== "string"
    ) return null;
    const consumed = normalizeQuantity(ingredient.quantity, ingredient.unit);
    if (!consumed || consumed.unit.dimension !== available.unit.dimension) {
      return null;
    }
    consumedBase += consumed.baseQuantity;
  }

  if (!matched) return null;
  const remainingBase = available.baseQuantity - consumedBase;
  if (remainingBase < -1e-9) return null;

  return Math.round(
    (Math.max(0, remainingBase) / available.unit.factorToBase + Number.EPSILON) *
      1_000_000,
  ) / 1_000_000;
}
