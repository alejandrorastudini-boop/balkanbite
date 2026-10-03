/**
 * Pantry item IDs are logical application IDs, not raw Firestore document IDs.
 * getScopedDocumentId URL-encodes them before persistence, so stable provenance
 * separators such as ":" are valid here.
 *
 * Keep the boundary conservative: trim-stable, bounded and free of control
 * characters. This accepts purchase-generated IDs such as
 * purchase-shopping:s2 without allowing empty/unbounded identifiers.
 */
export function isSafeInventoryLogicalId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 300 &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

/**
 * Purchase/provenance record IDs are not document IDs either. They may contain
 * ":" (shopping/reconcile/legacy prefixes) and are persisted as data fields.
 */
export function isSafeInventoryProvenanceId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 400 &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F]/.test(value);
}
