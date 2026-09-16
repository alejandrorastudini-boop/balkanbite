export interface ManualPantryQuantityInput {
  quantity: string;
  unit: string;
}

type ManualPantryValidationResult =
  | { valid: false }
  | { valid: true; quantity: number; unit: string };

/**
 * Manual pantry entries must have an explicitly entered, positive quantity and
 * a unit before they can become authoritative inventory. The returned values
 * are normalized only after both user-provided fields pass validation.
 */
export function validateManualPantryRequiredFields({
  quantity,
  unit,
}: ManualPantryQuantityInput): ManualPantryValidationResult {
  const trimmedQuantity = quantity.trim();
  const trimmedUnit = unit.trim();
  if (!trimmedQuantity || !trimmedUnit) return { valid: false };

  const parsedQuantity = Number(trimmedQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return { valid: false };
  }

  return {
    valid: true,
    quantity: parsedQuantity,
    unit: trimmedUnit,
  };
}
