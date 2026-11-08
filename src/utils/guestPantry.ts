import type { PantryItem } from "../types";
import { isLegacyDemoPantryItemId } from "./legacyDemoPantryIds";
import { isSafeInventoryLogicalId, isSafeInventoryProvenanceId } from "./inventoryIdentity";
import { inventoryLotStateMatchesQuantity } from "./inventoryLots";

export const GUEST_PANTRY_KEY = "balkanbite_pantry";
export const GUEST_PANTRY_QUARANTINE_KEY = "balkanbite_pantry_quarantine_v1";

export interface GuestPantryInspection {
  items: PantryItem[];
  requiresRecovery: boolean;
  /** Null means the original text was not a recognizable array. */
  quarantinedCount: number | null;
}

const categories = new Set(["Produce", "Dairy", "Meat/Fish", "Pantry/Grains", "Spices", "Other"]);
const sources = new Set(["pantry_legacy", "shopping_list", "confirmed_reconciliation"]);
const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const finiteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const finitePositive = (value: unknown): value is number =>
  finiteNonNegative(value) && value > 0;

function isStoredGuestRow(value: unknown): value is PantryItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (
    !isSafeInventoryLogicalId(row.id) ||
    !nonBlank(row.name) ||
    !finitePositive(row.quantity) ||
    !nonBlank(row.unit) ||
    !categories.has(row.category as string) ||
    !nonBlank(row.addedAt) ||
    (row.nameBg !== undefined && typeof row.nameBg !== "string") ||
    (row.nameEs !== undefined && typeof row.nameEs !== "string") ||
    (row.expiryDaysLeft !== undefined && !finiteNonNegative(row.expiryDaysLeft)) ||
    (row.estimatedCostEUR !== undefined &&
      row.estimatedCostEUR !== null && !finiteNonNegative(row.estimatedCostEUR)) ||
    (row.expiryIsPartial !== undefined && typeof row.expiryIsPartial !== "boolean") ||
    (row.lotState !== undefined &&
      !inventoryLotStateMatchesQuantity(row.quantity, row.unit, row.lotState as PantryItem["lotState"]))
  ) return false;

  if (row.purchaseHistory !== undefined) {
    if (!Array.isArray(row.purchaseHistory)) return false;
    for (const purchase of row.purchaseHistory) {
      if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) return false;
      const data = purchase as Record<string, unknown>;
      if (
        !isSafeInventoryProvenanceId(data.sourceId) ||
        !sources.has(data.source as string) ||
        !nonBlank(data.name) ||
        !finitePositive(data.quantity) ||
        !nonBlank(data.unit) ||
        !nonBlank(data.acquiredAt) ||
        (data.estimatedCostEUR !== undefined && !finiteNonNegative(data.estimatedCostEUR)) ||
        (data.expiryDaysLeft !== undefined && !finiteNonNegative(data.expiryDaysLeft))
      ) return false;
    }
  }
  return true;
}

/**
 * Classify local guest records without mutating the source.
 * Known legacy demo rows remain excluded; other malformed rows are
 * quarantined rather than treated as actual household inventory.
 */
export function inspectGuestPantry(raw: string | null): GuestPantryInspection {
  if (raw === null) return { items: [], requiresRecovery: false, quarantinedCount: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], requiresRecovery: true, quarantinedCount: null };
  }
  if (!Array.isArray(parsed)) {
    return { items: [], requiresRecovery: true, quarantinedCount: null };
  }

  const items: PantryItem[] = [];
  const ids = new Set<string>();
  let quarantinedCount = 0;
  for (const candidate of parsed) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
      isLegacyDemoPantryItemId((candidate as { id?: unknown }).id)) {
      continue;
    }
    if (!isStoredGuestRow(candidate) || ids.has(candidate.id)) {
      quarantinedCount += 1;
      continue;
    }
    ids.add(candidate.id);
    items.push(candidate);
  }
  return { items, requiresRecovery: quarantinedCount > 0, quarantinedCount };
}

/** Kept as a compatibility entrypoint for guest hydration. */
export function loadGuestPantry(raw: string | null): PantryItem[] {
  return inspectGuestPantry(raw).items;
}

export interface GuestPantryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type GuestPantrySaveResult =
  | { saved: true; recoveryAvailable: boolean }
  | { saved: false; reason: "invalid-items" | "backup-conflict" | "storage-unavailable" | "stale-snapshot" };

/**
 * Never rewrite malformed guest localStorage over the only recoverable copy.
 * First save the exact untouched source in a separate recovery key.
 * A failed/quota-limited or conflicting backup blocks the primary write.
 */
export function writeGuestPantrySafely(
  storage: GuestPantryStorage,
  items: readonly PantryItem[],
  expectedSnapshot?: readonly PantryItem[],
): GuestPantrySaveResult {
  if (!Array.isArray(items)) return { saved: false, reason: "invalid-items" };

  try {
    const serialized = JSON.stringify(items);
    const candidate = inspectGuestPantry(serialized);
    if (candidate.requiresRecovery || candidate.items.length !== items.length) {
      return { saved: false, reason: "invalid-items" };
    }

    const original = storage.getItem(GUEST_PANTRY_KEY);
    // A second tab may have written a newer pantry since this tab hydrated.
    // Do not replace a changed inventory with a stale local React snapshot.
    // This is a best-effort stale-view guard, NOT a cross-tab transaction.
    if (expectedSnapshot !== undefined &&
        JSON.stringify(inspectGuestPantry(original).items) !== JSON.stringify(expectedSnapshot)) {
      return { saved: false, reason: "stale-snapshot" };
    }
    let backup = storage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
    if (inspectGuestPantry(original).requiresRecovery) {
      if (original === null) return { saved: false, reason: "storage-unavailable" };
      if (backup !== null && backup !== original) {
        return { saved: false, reason: "backup-conflict" };
      }
      if (backup === null) {
        storage.setItem(GUEST_PANTRY_QUARANTINE_KEY, original);
        backup = storage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
        if (backup !== original) return { saved: false, reason: "storage-unavailable" };
      }
    }
    storage.setItem(GUEST_PANTRY_KEY, serialized);
    // An adapter can acknowledge setItem without actually persisting the bytes.
    // Never publish the inventory as committed until a readback confirms it.
    if (storage.getItem(GUEST_PANTRY_KEY) !== serialized) {
      return { saved: false, reason: "storage-unavailable" };
    }
    return { saved: true, recoveryAvailable: backup !== null };
  } catch {
    return { saved: false, reason: "storage-unavailable" };
  }
}
