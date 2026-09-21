import type { ShoppingItem } from "../types";

const AMOUNT_ORIGINS = new Set<NonNullable<ShoppingItem["amountOrigin"]>>([
  "user_entered",
  "ai_estimated",
  "deterministic_shortfall",
]);

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function directId(value: unknown): value is string {
  return nonBlank(value) && !value.includes("/");
}

function optionalFiniteNonNegative(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalAmountOrigin(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" &&
      AMOUNT_ORIGINS.has(value as NonNullable<ShoppingItem["amountOrigin"]>))
  );
}

/**
 * Non-destructive structural boundary for persisted shopping rows.
 *
 * Purchase confirmation is deliberately not required here. Persistence/display
 * and shopping -> pantry authority are separate concerns: legacy checked rows
 * may remain visible, while transferCheckedShoppingItems still requires
 * purchaseAmountConfirmed === true before inventory can change.
 */
export function isStoredShoppingItemStructurallyValid(
  value: unknown,
): value is ShoppingItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    directId(record.id) &&
    nonBlank(record.name) &&
    typeof record.quantity === "number" &&
    Number.isFinite(record.quantity) &&
    record.quantity > 0 &&
    nonBlank(record.unit) &&
    typeof record.category === "string" &&
    typeof record.checked === "boolean" &&
    optionalFiniteNonNegative(record.estimatedPriceEUR) &&
    optionalAmountOrigin(record.amountOrigin) &&
    optionalBoolean(record.purchaseAmountConfirmed) &&
    optionalString(record.reason)
  );
}

/**
 * Parses persisted shopping arrays while quarantining malformed rows.
 * Structurally valid rows are returned exactly as stored.
 */
export function parseStoredShoppingCache(
  raw: string | null,
): ShoppingItem[] | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(isStoredShoppingItemStructurallyValid);
  } catch {
    return null;
  }
}
