import type { PantryItem } from "../types";
import type {
  InventoryAdjustment,
  VerifiedStockExpectation,
} from "./inventoryAdjustmentFirestore";

/**
 * Pure, fail-closed planning only. The caller must first finish hydration
 * of the COMPLETE owner-filtered Firestore inventory snapshot. This marker
 * is a required precondition, not proof of Firebase authorization.
 *
 * No Firestore writes happen here. New items and metadata/unit changes
 * remain pending until their own authoritative creation/edit flows exist.
 */
export type RemoteStockRow = PantryItem & { cookRevision?: number };

export interface InventoryDeltaRequest {
  userId: string;
  remoteOwnerUserId: string;
  remoteSnapshotComplete: boolean;
  remote: readonly RemoteStockRow[];
  desired: readonly PantryItem[];
  explicitlyRemovedIds: readonly string[];
  // Snapshot captured when the user initiated each edit or explicit removal.
  // Never substitute the newer remote state for the user's original baseline.
  observedBeforeEdit: readonly VerifiedStockExpectation[];
}

export interface PlannedStockAdjustment {
  pantryItemId: string;
  expected: VerifiedStockExpectation;
  adjustment: InventoryAdjustment;
}

export type InventoryDeltaIssue =
  | "authority-unavailable"
  | "invalid-or-duplicate-id"
  | "invalid-remote-stock"
  | "new-item-needs-confirmation"
  | "unexpected-omission"
  | "ambiguous-removal"
  | "unsupported-edit"
  | "invalid-quantity"
  | "unverified-intent-baseline"
  | "stale-intent-baseline";

export type InventoryDeltaPlan =
  | {
      outcome: "ready";
      unchangedIds: string[];
      adjustments: PlannedStockAdjustment[];
    }
  | {
      outcome: "needs-review";
      issues: { pantryItemId: string; reason: InventoryDeltaIssue }[];
      adjustments: [];
    };

const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const validQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= 0 && value < Number.MAX_SAFE_INTEGER;

function identicalExceptQuantity(a: PantryItem, b: PantryItem): boolean {
  return a.name === b.name &&
    a.nameBg === b.nameBg &&
    a.nameEs === b.nameEs &&
    a.unit === b.unit &&
    a.category === b.category &&
    a.expiryDaysLeft === b.expiryDaysLeft &&
    a.estimatedCostEUR === b.estimatedCostEUR &&
    a.addedAt === b.addedAt &&
    a.expiryIsPartial === b.expiryIsPartial &&
    JSON.stringify(a.purchaseHistory ?? null) ===
      JSON.stringify(b.purchaseHistory ?? null);
}

export function planAuthoritativeInventoryDelta(
  input: InventoryDeltaRequest,
): InventoryDeltaPlan {
  const issues: { pantryItemId: string; reason: InventoryDeltaIssue }[] = [];
  const fail = (id: string, reason: InventoryDeltaIssue) =>
    issues.push({ pantryItemId: id, reason });

  if (!safeId(input.userId) ||
      input.remoteOwnerUserId !== input.userId ||
      input.remoteSnapshotComplete !== true) {
    return {
      outcome: "needs-review",
      issues: [{ pantryItemId: "authority", reason: "authority-unavailable" }],
      adjustments: [],
    };
  }

  const remote = new Map<string, RemoteStockRow>();
  const desired = new Map<string, PantryItem>();
  const removals = new Set<string>();
  const observed = new Map<string, VerifiedStockExpectation>();
  for (const origin of input.observedBeforeEdit) {
    if (!origin || !safeId(origin.pantryItemId) ||
        !validQuantity(origin.quantity) ||
        typeof origin.unit !== "string" || !origin.unit.trim() ||
        !validRevision(origin.cookRevision) ||
        observed.has(origin.pantryItemId)) {
      fail(origin?.pantryItemId ?? "unknown", "unverified-intent-baseline");
      continue;
    }
    observed.set(origin.pantryItemId, origin);
  }

  for (const row of input.remote) {
    if (!row || !safeId(row.id) || remote.has(row.id)) {
      fail(row?.id ?? "unknown", "invalid-or-duplicate-id");
      continue;
    }
    if (!validQuantity(row.quantity) || typeof row.unit !== "string" ||
        !row.unit.trim() ||
        // Revision zero is allowed ONLY for a verified legacy remote row.
        (row.cookRevision !== undefined && !validRevision(row.cookRevision))) {
      fail(row.id, "invalid-remote-stock");
    }
    remote.set(row.id, row);
  }
  for (const row of input.desired) {
    if (!row || !safeId(row.id) || desired.has(row.id)) {
      fail(row?.id ?? "unknown", "invalid-or-duplicate-id");
      continue;
    }
    if (!validQuantity(row.quantity)) fail(row.id, "invalid-quantity");
    desired.set(row.id, row);
  }
  for (const id of input.explicitlyRemovedIds) {
    if (!safeId(id) || removals.has(id)) {
      fail(id, "invalid-or-duplicate-id");
    } else {
      removals.add(id);
    }
  }

  const adjustments: PlannedStockAdjustment[] = [];
  const unchangedIds: string[] = [];
  for (const [id, stock] of remote) {
    const local = desired.get(id);
    const removed = removals.has(id);
    if (removed && local) {
      fail(id, "ambiguous-removal");
      continue;
    }
    if (!local && !removed) {
      fail(id, "unexpected-omission");
      continue;
    }
    const expected: VerifiedStockExpectation = {
      pantryItemId: id,
      quantity: stock.quantity,
      unit: stock.unit,
      cookRevision: stock.cookRevision ?? 0,
    };
    if (local && !removed && identicalExceptQuantity(stock, local) &&
        stock.quantity === local.quantity) {
      unchangedIds.push(id);
      continue;
    }
    if (local && !removed && !identicalExceptQuantity(stock, local)) {
      fail(id, "unsupported-edit");
      continue;
    }
    const origin = observed.get(id);
    if (!origin) {
      fail(id, "unverified-intent-baseline");
      continue;
    }
    if (origin.quantity !== stock.quantity ||
        origin.unit !== stock.unit ||
        origin.cookRevision !== (stock.cookRevision ?? 0)) {
      fail(id, "stale-intent-baseline");
      continue;
    }
    if (removed) {
      adjustments.push({ pantryItemId: id, expected, adjustment: { kind: "remove" } });
    } else if (local) {
      adjustments.push({
        pantryItemId: id,
        expected,
        adjustment: { kind: "set-quantity", quantity: local.quantity },
      });
    }
  }
  for (const id of desired.keys()) {
    if (!remote.has(id)) fail(id, "new-item-needs-confirmation");
  }
  for (const id of removals) {
    if (!remote.has(id)) fail(id, "ambiguous-removal");
  }

  if (issues.length > 0) return { outcome: "needs-review", issues, adjustments: [] };
  return {
    outcome: "ready",
    unchangedIds: unchangedIds.sort(),
    adjustments: adjustments.sort((a, b) =>
      a.pantryItemId.localeCompare(b.pantryItemId)),
  };
}
