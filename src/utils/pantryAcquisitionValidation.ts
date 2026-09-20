export interface PantryAcquisitionRequiredFields {
  name: unknown;
  quantity: unknown;
  unit: unknown;
}

/**
 * Authoritative pantry acquisition requires explicit identity and amount.
 * Optional metadata (category, price, expiry, provenance) is validated at its
 * own boundary and is never defaulted here.
 */
export function hasValidPantryAcquisitionRequiredFields(
  item: PantryAcquisitionRequiredFields,
): boolean {
  return (
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    typeof item.unit === "string" &&
    item.unit.trim().length > 0
  );
}

export function isValidPantryAcquisitionBatch(
  items: readonly PantryAcquisitionRequiredFields[],
): boolean {
  return (
    items.length > 0 &&
    items.every(hasValidPantryAcquisitionRequiredFields)
  );
}
