import { isServerConfirmedInventorySnapshot, type InventorySnapshotMetadata } from "./inventorySnapshotAuthority";
import { getSyncedItemKey } from "./cloudCollectionSync";
import { isStoredMealPlanDayStructurallyValid } from "./storedMealPlanValidation";
import { isStoredShoppingItemStructurallyValid } from "./storedShoppingValidation";
import { isValidProgressionEvent, type ProgressionEventV1 } from "./progressionLedger";

export type ChefCollectionForRead = "mealPlans" | "shoppingList";
export interface ChefReadDocument {
  documentId: string;
  data: Record<string, unknown>;
  hasPendingWrites: boolean;
}
export interface ChefServerReadEvidence {
  userId: string;
  serialized: string;
}

/**
 * Only a complete owner-filtered server snapshot may attest menu/shopping.
 * Do not confuse display hydration (which can be cached or filtered) with
 * read authority. Duplicate legacy/canonical documents fail closed rather
 * than letting a dropped row disappear from a Chef factual answer.
 */
export function deriveChefServerCollectionRead(
  collectionName: ChefCollectionForRead,
  userId: string,
  metadata: InventorySnapshotMetadata,
  docs: readonly ChefReadDocument[],
): ChefServerReadEvidence | null {
  if (!userId || !isServerConfirmedInventorySnapshot(metadata) ||
      !Array.isArray(docs)) return null;
  const rows: Record<string, unknown>[] = [];
  const keys = new Set<string>();
  for (const doc of docs) {
    if (!doc || doc.hasPendingWrites !== false ||
        typeof doc.documentId !== "string" || !doc.documentId ||
        !doc.data || typeof doc.data !== "object" || Array.isArray(doc.data) ||
        doc.data.userId !== userId) return null;
    const { userId: _owner, ...item } = doc.data;
    const valid = collectionName === "mealPlans"
      ? isStoredMealPlanDayStructurallyValid(item)
      : isStoredShoppingItemStructurallyValid(item);
    const key = getSyncedItemKey(collectionName, item);
    if (!valid || !key || keys.has(key)) return null;
    keys.add(key);
    rows.push(item);
  }
  return { userId, serialized: JSON.stringify(rows) };
}

/**
 * Progression has a user-owned subcollection and a separate listener. It must
 * not use the UI's filtered list to attest that every remote event is valid.
 */
export function deriveChefServerProgressRead(
  userId: string,
  metadata: InventorySnapshotMetadata,
  docs: readonly ChefReadDocument[],
): ChefServerReadEvidence | null {
  if (!userId || !isServerConfirmedInventorySnapshot(metadata) ||
      !Array.isArray(docs)) return null;
  const events: ProgressionEventV1[] = [];
  const ids = new Set<string>();
  for (const doc of docs) {
    if (!doc || doc.hasPendingWrites !== false ||
        typeof doc.documentId !== "string" || !doc.documentId ||
        !doc.data || typeof doc.data !== "object" || Array.isArray(doc.data) ||
        doc.data.userId !== userId || ids.has(doc.documentId)) return null;
    const { userId: _owner, requestSignature: _signature, createdAt: _created,
      ...eventData } = doc.data;
    const event = { ...eventData, eventId: doc.documentId };
    if (!isValidProgressionEvent(event)) return null;
    ids.add(doc.documentId);
    events.push({
      version: 1, eventId: event.eventId, type: event.type,
      occurredAt: event.occurredAt,
      evidence: "deterministic_state_transition", evidenceCount: event.evidenceCount,
    });
  }
  // Match the existing subscription ordering exactly.
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return { userId, serialized: JSON.stringify(events) };
}

export function selectCompleteChefServerWorkspace(
  userId: string | null,
  sessionUserId: string | null | undefined,
  authority: {
    mealPlans?: ChefServerReadEvidence;
    shoppingList?: ChefServerReadEvidence;
    progression?: ChefServerReadEvidence;
  },
  visible: {
    mealPlan: readonly unknown[];
    shopping: readonly unknown[];
    progression: readonly unknown[];
  },
): { mealPlan: unknown[]; shopping: unknown[]; progression: unknown[] } | null {
  if (!userId || sessionUserId !== userId) return null;
  const parts = [
    [authority.mealPlans, visible.mealPlan],
    [authority.shoppingList, visible.shopping],
    [authority.progression, visible.progression],
  ] as const;
  for (const [evidence, rows] of parts) {
    if (!evidence || evidence.userId !== userId ||
        evidence.serialized !== JSON.stringify(rows)) return null;
  }
  // Use exactly the proven serializations, not a potentially stale data cache.
  return {
    mealPlan: JSON.parse(authority.mealPlans!.serialized) as unknown[],
    shopping: JSON.parse(authority.shoppingList!.serialized) as unknown[],
    progression: JSON.parse(authority.progression!.serialized) as unknown[],
  };
}
