export type SyncedCollectionName =
  | "inventory"
  | "recipes"
  | "mealPlans"
  | "shoppingList";

const nonBlank = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Stable logical key for a synced item. Meal-plan days are keyed by date;
 * the other current collection models carry an explicit id.
 */
export function getSyncedItemKey(
  collectionName: string,
  item: unknown,
): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;

  if (collectionName === "mealPlans") {
    return nonBlank(record.date);
  }

  if (
    collectionName === "inventory" ||
    collectionName === "recipes" ||
    collectionName === "shoppingList"
  ) {
    return nonBlank(record.id);
  }

  return undefined;
}

export function findRemovedDocumentIds(
  hydratedDocumentIds: Iterable<string>,
  currentDocumentIds: Iterable<string>,
): string[] {
  const current = new Set(currentDocumentIds);
  return Array.from(new Set(hydratedDocumentIds)).filter(
    (documentId) => !current.has(documentId),
  );
}
