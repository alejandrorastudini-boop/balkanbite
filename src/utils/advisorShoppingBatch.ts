import type { ShoppingItem } from "../types";

type AdvisorShoppingItem = Omit<ShoppingItem, "id" | "checked">;

const normalizeIdentityText = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function buildAdvisorBatchFingerprint(
  items: AdvisorShoppingItem[],
): string {
  return JSON.stringify(
    items
      .map((item) => ({
        name: normalizeIdentityText(item.name),
        quantity: item.quantity,
        unit: normalizeIdentityText(item.unit),
        category: item.category,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  );
}
