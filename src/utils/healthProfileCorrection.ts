import type {
  HealthDataStatus,
  HealthProfile,
} from "../types";
import {
  sanitizeHealthProfile,
  type HealthProfileFieldKey,
} from "./healthProfile";

export interface ExistingHealthFieldCorrection {
  status: HealthDataStatus;
  value?: unknown;
  recordedAt: string;
}

export type ExistingHealthFieldCorrectionResult =
  | {
      ok: true;
      profile: HealthProfile;
    }
  | {
      ok: false;
      reason:
        | "profile_absent"
        | "field_absent"
        | "invalid_recorded_at"
        | "invalid_correction";
      profile: HealthProfile | undefined;
    };

const hasValidRecordedAt = (value: string): boolean =>
  value.trim().length > 0 && Number.isFinite(Date.parse(value));

/**
 * Corrects exactly one already-existing HealthProfile field.
 *
 * This helper is intentionally unable to add missing fields. A user correction
 * becomes self-reported data with a new recordedAt timestamp. Invalid input
 * returns the sanitized original profile unchanged instead of deleting or
 * fabricating a datum.
 */
export function correctExistingHealthProfileField(
  profile: HealthProfile | undefined,
  field: HealthProfileFieldKey,
  correction: ExistingHealthFieldCorrection,
): ExistingHealthFieldCorrectionResult {
  const safe = sanitizeHealthProfile(profile);
  if (!safe) {
    return {
      ok: false,
      reason: "profile_absent",
      profile: undefined,
    };
  }

  if (!safe[field]) {
    return {
      ok: false,
      reason: "field_absent",
      profile: safe,
    };
  }

  if (!hasValidRecordedAt(correction.recordedAt)) {
    return {
      ok: false,
      reason: "invalid_recorded_at",
      profile: safe,
    };
  }

  const candidate =
    correction.status === "known"
      ? {
          status: "known" as const,
          value: correction.value,
          source: "self_reported" as const,
          recordedAt: correction.recordedAt,
        }
      : {
          status: correction.status,
          source: "self_reported" as const,
          recordedAt: correction.recordedAt,
        };

  const next = sanitizeHealthProfile({
    ...safe,
    [field]: candidate,
  });

  const corrected = next?.[field];
  if (
    !next ||
    !corrected ||
    corrected.status !== correction.status ||
    corrected.source !== "self_reported" ||
    corrected.recordedAt !== correction.recordedAt
  ) {
    return {
      ok: false,
      reason: "invalid_correction",
      profile: safe,
    };
  }

  return {
    ok: true,
    profile: next,
  };
}
