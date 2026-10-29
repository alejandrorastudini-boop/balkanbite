import { GUEST_EXPORT_KEYS } from "./guestLocalExport";

/** Read-only format check: no recovery, data integrity or cross-tab guarantee. */
export function inspectGuestLocalExportStructure(raw: string): "recognized" | "unrecognized" {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return "unrecognized"; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return "unrecognized";
  const item = data as Record<string, unknown>;
  const keys = ["format", "version", "scope", "capturedAt", "consistency", "restoreSupported", "values"];
  if (Object.keys(item).length !== keys.length || !keys.every(k => Object.hasOwn(item, k))) return "unrecognized";
  if (item.format !== "balkanbite-guest-raw-export" || item.version !== 1 ||
      item.scope !== "guest-local-only" || item.consistency !== "best-effort-not-atomic-across-tabs" ||
      item.restoreSupported !== false || typeof item.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(item.capturedAt))) return "unrecognized";
  const values = item.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return "unrecognized";
  const object = values as Record<string, unknown>;
  if (Object.keys(object).length !== GUEST_EXPORT_KEYS.length ||
      !GUEST_EXPORT_KEYS.every(key =>
        Object.hasOwn(object, key) && (object[key] === null || typeof object[key] === "string"))) {
    return "unrecognized";
  }
  return "recognized";
}
