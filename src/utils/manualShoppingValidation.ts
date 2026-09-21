export interface ManualShoppingRequiredFields {
  name: unknown;
  quantity: unknown;
  unit: unknown;
}

export function hasValidManualShoppingRequiredFields(
  item: ManualShoppingRequiredFields,
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
