export interface PantryAcquisitionRequiredFields {
  name: unknown;
  quantity: unknown;
  unit: unknown;
}

/**
 * Authoritative pantry acquisition requires explicit identity and amount.
 * Optional metadata (category, price, expiry, provenance) is validated at its
 * own boundary and is never defaulted here.
 *
 * The runtime boundary may receive malformed data despite TypeScript types.
 * It must not throw or approve sparse collections with missing entries.
 */
export function hasValidPantryAcquisitionRequiredFields(item: unknown): boolean {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }
  const fields = item as Record<string, unknown>;
  return (
    typeof fields.name === "string" &&
    fields.name.trim().length > 0 &&
    typeof fields.quantity === "number" &&
    Number.isFinite(fields.quantity) &&
    fields.quantity > 0 &&
    typeof fields.unit === "string" &&
    fields.unit.trim().length > 0
  );
}

export function isValidPantryAcquisitionBatch(items: unknown): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;

  // Array.every skips holes. Iteration visits them as undefined, so partial
  // batches can never be accepted as complete authoritative acquisitions.
  for (const item of items) {
    if (!hasValidPantryAcquisitionRequiredFields(item)) return false;
  }
  return true;
}
