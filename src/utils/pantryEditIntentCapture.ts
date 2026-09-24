import { getScopedDocumentId } from "./cloudCollectionSync";
import type { VerifiedStockExpectation } from "./inventoryAdjustmentFirestore";

/**
 * Only construct this input inside the owner-filtered Firebase onSnapshot
 * listener. Metadata flags are prerequisites, NOT an authorization token.
 * The Firestore rules and transaction must independently enforce ownership.
 */
export interface FirestoreInventorySnapshotEvidence {
  userId: string;
  fromCache: boolean;
  hasPendingWrites: boolean;
  documents: readonly {
    documentId: string;
    hasPendingWrites: boolean;
    // Firestore DocumentData is schemaless at this boundary. Every field
    // is validated at runtime instead of asserting required TS properties.
    data: Record<string, unknown>;
  }[];
}

export interface ViewedPantryLot {
  id: unknown;
  quantity: unknown;
  unit: unknown;
  cookRevision?: unknown;
}

export type InventoryEditAuthority =
  | {
      status: "verified";
      userId: string;
      observed: readonly VerifiedStockExpectation[];
    }
  | {
      status: "unavailable";
      reason: "unverified-snapshot" | "ambiguous-stock";
    };

export type CapturedPantryEdit =
  | { outcome: "captured"; observedBeforeEdit: VerifiedStockExpectation }
  | {
      outcome: "needs-review";
      reason: "unverified-authority" | "missing-stock" | "stale-local-view";
    };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);
const quantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const revision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= 0 && value < Number.MAX_SAFE_INTEGER;

/**
 * The full owner query must have confirmed server metadata and no pending
 * local writes. Every active row must have an owner-scoped canonical document
 * and verifiable stock. Legacy-only rows require a separate migration, not
 * an inferred canonical doc that does not yet exist on the server.
 */
export function verifyServerInventoryForEdits(
  input: FirestoreInventorySnapshotEvidence,
): InventoryEditAuthority {
  if (!input || !safeUid(input.userId) || input.fromCache !== false ||
      input.hasPendingWrites !== false || !Array.isArray(input.documents)) {
    return { status: "unavailable", reason: "unverified-snapshot" };
  }

  const observed = new Map<string, VerifiedStockExpectation>();
  for (const document of input.documents) {
    if (!document || document.hasPendingWrites !== false ||
        !document.data || document.data.userId !== input.userId) {
      return { status: "unavailable", reason: "unverified-snapshot" };
    }
    const row = document.data;
    if (row._deleted === true) continue;
    if (!safeId(row.id) || document.documentId !==
        getScopedDocumentId(input.userId, row.id) ||
        !quantity(row.quantity) || typeof row.unit !== "string" ||
        !row.unit.trim() ||
        (row.cookRevision !== undefined && !revision(row.cookRevision)) ||
        observed.has(row.id)) {
      return { status: "unavailable", reason: "ambiguous-stock" };
    }
    observed.set(row.id, {
      pantryItemId: row.id,
      quantity: row.quantity,
      unit: row.unit,
      // Zero is valid only for a row verified by this server snapshot.
      cookRevision: row.cookRevision ?? 0,
    });
  }
  return {
    status: "verified",
    userId: input.userId,
    observed: [...observed.values()].sort((a, b) =>
      a.pantryItemId.localeCompare(b.pantryItemId)),
  };
}

/**
 * Capture EXACTLY what the user saw when they clicked edit/remove.
 * Never replace an obsolete local view with newer server quantities.
 * This is capture-only; it performs no writes and never applies a delta.
 */
export function capturePantryEditIntent(
  authority: InventoryEditAuthority,
  activeUserId: string,
  viewed: ViewedPantryLot,
): CapturedPantryEdit {
  if (authority.status !== "verified" || authority.userId !== activeUserId) {
    return { outcome: "needs-review", reason: "unverified-authority" };
  }
  if (!safeId(viewed?.id)) {
    return { outcome: "needs-review", reason: "missing-stock" };
  }
  const source = authority.observed.find(item => item.pantryItemId === viewed.id);
  if (!source) return { outcome: "needs-review", reason: "missing-stock" };
  if (!quantity(viewed.quantity) ||
      viewed.quantity !== source.quantity ||
      viewed.unit !== source.unit ||
      // A UI row without revision must never claim to have seen a
      // versioned lot. Genuine legacy stock can be revision zero.
      (viewed.cookRevision ?? 0) !== source.cookRevision) {
    return { outcome: "needs-review", reason: "stale-local-view" };
  }
  return { outcome: "captured", observedBeforeEdit: { ...source } };
}
