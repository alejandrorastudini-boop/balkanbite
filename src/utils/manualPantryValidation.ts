export interface ManualPantryRequiredInput {
  quantity: string;
  unit: string;
}

export type ManualPantryValidationResult =
  | { valid: false; error: "quantity-required" | "quantity-invalid" | "unit-required" }
  | { valid: true; quantity: number; unit: string };

/**
 * Validates the two authoritative fields required for a manual pantry entry.
 * This deliberately supplies no fallback quantity or unit: missing values must
 * be confirmed by the user before the item can be persisted.
 */
export function validateManualPantryRequiredFields(
  input: ManualPantryRequiredInput,
): ManualPantryValidationResult {
  const rawQuantity = input.quantity.trim();
  if (!rawQuantity) return { valid: false, error: "quantity-required" };

  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { valid: false, error: "quantity-invalid" };
  }

  const unit = input.unit.trim();
  if (!unit) return { valid: false, error: "unit-required" };

  return { valid: true, quantity, unit };
}
