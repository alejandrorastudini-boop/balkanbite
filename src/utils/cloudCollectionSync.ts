export type SyncedCollectionName =
  | "inventory"
  | "recipes"
  | "mealPlans"
  | "shoppingList";

const nonBlank = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const directDocumentKey = (value: unknown): string | undefined => {
  const key = nonBlank(value);
  return key && !key.includes("/") ? key : undefined;
};

export const getScopedDocumentId = (userId: string, logicalId: string) =>
  `u_${encodeURIComponent(userId)}__${encodeURIComponent(logicalId)}`;

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
    return directDocumentKey(record.date);
  }

  if (collectionName === "inventory") {
    return nonBlank(record.id);
  }

  if (collectionName === "recipes" || collectionName === "shoppingList") {
    return directDocumentKey(record.id);
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


export interface RemoteCollectionEntry<T = Record<string, unknown>> {
  documentId: string;
  item: T;
}

export function selectCanonicalRemoteEntries<T>(
  collectionName: string,
  remoteEntries: readonly RemoteCollectionEntry<T>[],
  canonicalDocumentIdForKey: (logicalKey: string) => string = (logicalKey) =>
    logicalKey,
): {
  entries: RemoteCollectionEntry<T>[];
  trackedDocumentIds: string[];
} {
  const validEntries = remoteEntries.filter(({ item }) =>
    Boolean(getSyncedItemKey(collectionName, item))
  );

  const byLogicalKey = new Map<string, RemoteCollectionEntry<T>>();
  for (const entry of validEntries) {
    const logicalKey = getSyncedItemKey(collectionName, entry.item)!;
    const existing = byLogicalKey.get(logicalKey);
    const canonicalDocumentId = canonicalDocumentIdForKey(logicalKey);
    const entryIsCanonical = entry.documentId === canonicalDocumentId;
    const existingIsCanonical =
      existing?.documentId === canonicalDocumentId;

    if (!existing || (entryIsCanonical && !existingIsCanonical)) {
      byLogicalKey.set(logicalKey, entry);
    }
  }

  return {
    entries: Array.from(byLogicalKey.values()),
    trackedDocumentIds: validEntries.map(({ documentId }) => documentId),
  };
}
