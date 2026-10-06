import type { HealthDataStatus, HealthProfile } from "../types";
import { sanitizeHealthProfile, type HealthProfileFieldKey } from "./healthProfile";

export interface SelfReportedHealthFieldEntry {
  status: HealthDataStatus;
  value?: unknown;
  recordedAt: string;
}

export type HealthFieldEntryResult =
  | { ok: true; profile: HealthProfile }
  | {
      ok: false;
      reason: "invalid_recorded_at" | "invalid_entry";
      profile: HealthProfile | undefined;
    };

export function setSelfReportedHealthProfileField(
  profile: HealthProfile | undefined,
  field: HealthProfileFieldKey,
  entry: SelfReportedHealthFieldEntry,
): HealthFieldEntryResult {
  const safe = sanitizeHealthProfile(profile);
  if (!entry.recordedAt.trim() || !Number.isFinite(Date.parse(entry.recordedAt))) {
    return { ok: false, reason: "invalid_recorded_at", profile: safe };
  }

  const candidate =
    entry.status === "known"
      ? {
          status: "known" as const,
          value: entry.value,
          source: "self_reported" as const,
          recordedAt: entry.recordedAt,
        }
      : {
          status: entry.status,
          source: "self_reported" as const,
          recordedAt: entry.recordedAt,
        };

  const next = sanitizeHealthProfile({
    ...(safe ?? { version: 1 }),
    [field]: candidate,
  });
  const stored = next?.[field];

  if (
    !next ||
    !stored ||
    stored.status !== entry.status ||
    stored.source !== "self_reported" ||
    stored.recordedAt !== entry.recordedAt
  ) {
    return { ok: false, reason: "invalid_entry", profile: safe };
  }

  return { ok: true, profile: next };
}
