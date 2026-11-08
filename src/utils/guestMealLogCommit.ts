import type { MealLog } from "../types";
import type { GuestPantryStorage } from "./guestPantry";
import { sanitizeStoredMealLog } from "./verifiedMealLog";

const KEY = "balkanbite_meallogs";

type MealLogStoreResult =
  | { saved: true; next: MealLog[] }
  | { saved: false; reason: "invalid-view" | "invalid-log" | "duplicate-id" |
      "incomplete-source" | "stale-snapshot" | "storage-unavailable" };

// Sort object keys before equality to avoid treating innocuous property order
// as data loss. Arrays retain order. No numeric inference or unit conversions.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort()
      .map(k => JSON.stringify(k) + ":" + canonical(object[k])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "undefined";
}

function strictCanonicalLog(value: unknown): MealLog | null {
  const parsed = sanitizeStoredMealLog(value);
  return parsed && canonical(parsed) === canonical(value) ? parsed : null;
}

/**
 * Historic guest meal history may contain unknown or legacy measurements.
 * A filtered view is not an authoritative full source and must not overwrite
 * original bytes; tell the user to review/export instead.
 */
function inspectSource(raw: string | null): MealLog[] | null {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const result = parsed.map(strictCanonicalLog);
    if (result.some(x => x === null)) return null;
    const full = result as MealLog[];
    if (new Set(full.map(x => x.id)).size !== full.length) return null;
    return full;
  } catch {
    return null;
  }
}

export function isGuestMealLogSnapshotVerified(
  storage: Pick<GuestPantryStorage, "getItem">,
  visible: readonly MealLog[],
): boolean {
  try {
    if (!Array.isArray(visible)) return false;
    const first = storage.getItem(KEY);
    const stored = inspectSource(first);
    if (!stored || canonical(stored) !== canonical(visible)) return false;
    return storage.getItem(KEY) === first;
  } catch {
    return false;
  }
}

/** Confirm a new human meal-history fact before publishing it to React. */
export function commitVerifiedGuestMealLog(
  storage: GuestPantryStorage,
  visible: readonly MealLog[],
  added: MealLog,
): MealLogStoreResult {
  if (!Array.isArray(visible)) return { saved: false, reason: "invalid-view" };
  const validNew = strictCanonicalLog(added);
  if (!validNew) return { saved: false, reason: "invalid-log" };
  try {
    const before = storage.getItem(KEY);
    const current = inspectSource(before);
    if (!current) return { saved: false, reason: "incomplete-source" };
    if (canonical(current) !== canonical(visible)) {
      return { saved: false, reason: "stale-snapshot" };
    }
    if (current.some(log => log.id === validNew.id)) {
      return { saved: false, reason: "duplicate-id" };
    }
    if (storage.getItem(KEY) !== before) {
      return { saved: false, reason: "stale-snapshot" };
    }
    const next = [...current, validNew];
    const raw = JSON.stringify(next);
    storage.setItem(KEY, raw);
    if (storage.getItem(KEY) !== raw) {
      return { saved: false, reason: "storage-unavailable" };
    }
    return { saved: true, next };
  } catch {
    return { saved: false, reason: "storage-unavailable" };
  }
}
