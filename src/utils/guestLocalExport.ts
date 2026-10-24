/**
 * Read-only user-triggered guest data archive. Unknown or malformed raw bytes
 * are preserved verbatim, not normalized or silently filtered.
 * This is a best-effort local snapshot, NOT an atomic cross-tab transaction.
 */
export const GUEST_EXPORT_KEYS = [
  "balkanbite_pantry",
  "balkanbite_pantry_quarantine_v1",
  "balkanbite_recipes",
  "balkanbite_mealplan",
  "balkanbite_shopping",
  "balkanbite_progression",
  "balkanbite_meallogs",
  "balkanbite_chat_messages",
  "balkanbite_profile",
  "balkanbite_guest_pantry_shopping_journal_v1",
  "balkanbite_guest_purchase_intent_v1",
  "balkanbite_guest_cook_intent_v1",
  "balkanbite_guest_cook_derived_intent_v1",
  "balkanbite_guest_voice_removal_intent_v1",
] as const;

type GuestExportStorage = Pick<Storage, "getItem">;
type GuestExportValue = string | null;
export type GuestExportResult =
  | { ok: true; content: string; presentKeys: number }
  | { ok: false; reason: "unavailable" | "changed-during-read" | "no-data" };

export function captureGuestLocalSnapshot(
  storage: GuestExportStorage,
  capturedAt: string,
): GuestExportResult {
  try {
    const first = {} as Record<(typeof GUEST_EXPORT_KEYS)[number], GuestExportValue>;
    for (const key of GUEST_EXPORT_KEYS) {
      first[key] = storage.getItem(key);
      if (first[key] !== null && typeof first[key] !== "string") {
        return { ok: false, reason: "unavailable" };
      }
    }
    // A second complete read catches changed data during capture. It does
    // not provide cross-tab CAS/atomicity and must not be advertised as such.
    for (const key of GUEST_EXPORT_KEYS) {
      if (storage.getItem(key) !== first[key]) {
        return { ok: false, reason: "changed-during-read" };
      }
    }
    const presentKeys = GUEST_EXPORT_KEYS.filter(key => first[key] !== null).length;
    if (!presentKeys) return { ok: false, reason: "no-data" };
    const values: Record<string, GuestExportValue> = {};
    for (const key of GUEST_EXPORT_KEYS) values[key] = first[key];
    return {
      ok: true,
      presentKeys,
      content: JSON.stringify({
        format: "balkanbite-guest-raw-export",
        version: 1,
        scope: "guest-local-only",
        capturedAt,
        consistency: "best-effort-not-atomic-across-tabs",
        restoreSupported: false,
        values,
      }, null, 2),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
