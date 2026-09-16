export interface ManualPantryInput {
  quantity: string;
  unit: string;
  expiryDays?: string;
  cost?: string;
}

type ManualPantryValidationResult =
  | { valid: false }
  | {
      valid: true;
      quantity: number;
      unit: string;
      expiryDays?: number;
      cost?: number;
    };

/**
 * Manual pantry entries must have an explicitly entered, positive quantity and
 * a unit before they can become authoritative inventory. Optional expiry and
 * cost values remain absent unless the user explicitly supplies valid values.
 */
export function validateManualPantryRequiredFields({
  quantity,
  unit,
  expiryDays = "",
  cost = "",
}: ManualPantryInput): ManualPantryValidationResult {
  const trimmedQuantity = quantity.trim();
  const trimmedUnit = unit.trim();
  const trimmedExpiryDays = expiryDays.trim();
  const trimmedCost = cost.trim();
  if (!trimmedQuantity || !trimmedUnit) return { valid: false };

  const parsedQuantity = Number(trimmedQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return { valid: false };
  }

  const parsedExpiryDays = trimmedExpiryDays
    ? Number(trimmedExpiryDays)
    : undefined;
  if (
    parsedExpiryDays !== undefined &&
    (!Number.isFinite(parsedExpiryDays) || parsedExpiryDays < 0)
  ) {
    return { valid: false };
  }

  const parsedCost = trimmedCost ? Number(trimmedCost) : undefined;
  if (
    parsedCost !== undefined &&
    (!Number.isFinite(parsedCost) || parsedCost < 0)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    quantity: parsedQuantity,
    unit: trimmedUnit,
    ...(parsedExpiryDays !== undefined
      ? { expiryDays: parsedExpiryDays }
      : {}),
    ...(parsedCost !== undefined ? { cost: parsedCost } : {}),
  };
}
