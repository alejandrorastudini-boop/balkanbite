import type {
  HealthDataSource,
  HealthDataStatus,
  HealthDatum,
  HealthProfile,
} from "../types";

const HEALTH_DATA_STATUSES = new Set<HealthDataStatus>([
  "known",
  "unknown",
  "not_applicable",
  "prefer_not_to_say",
]);

const HEALTH_DATA_SOURCES = new Set<HealthDataSource>([
  "self_reported",
  "measured",
  "imported",
  "estimated",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const positiveFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;

const validRecordedAt = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || !Number.isFinite(Date.parse(trimmed))) return undefined;
  return trimmed;
};

function sanitizePositiveNumberDatum(
  value: unknown,
): HealthDatum<number> | undefined {
  if (!isRecord(value)) return undefined;

  const status =
    typeof value.status === "string" &&
    HEALTH_DATA_STATUSES.has(value.status as HealthDataStatus)
      ? (value.status as HealthDataStatus)
      : undefined;
  if (!status) return undefined;

  const source =
    typeof value.source === "string" &&
    HEALTH_DATA_SOURCES.has(value.source as HealthDataSource)
      ? (value.source as HealthDataSource)
      : undefined;
  const recordedAt = validRecordedAt(value.recordedAt);

  if (status !== "known") {
    return {
      status,
      ...(source ? { source } : {}),
      ...(recordedAt ? { recordedAt } : {}),
    };
  }

  const numericValue = positiveFiniteNumber(value.value);
  if (numericValue === undefined) return undefined;

  return {
    status: "known",
    value: numericValue,
    ...(source ? { source } : {}),
    ...(recordedAt ? { recordedAt } : {}),
  };
}

function legacySelfReportedDatum(
  value: unknown,
): HealthDatum<number> | undefined {
  const numericValue = positiveFiniteNumber(value);
  return numericValue === undefined
    ? undefined
    : {
        status: "known",
        value: numericValue,
        source: "self_reported",
      };
}

export function sanitizeHealthProfile(
  value: unknown,
  legacyHeightCm?: unknown,
  legacyWeightKg?: unknown,
): HealthProfile | undefined {
  const raw = isRecord(value) ? value : undefined;

  const hasNestedAge =
    raw !== undefined && Object.prototype.hasOwnProperty.call(raw, "ageYears");
  const hasNestedHeight =
    raw !== undefined && Object.prototype.hasOwnProperty.call(raw, "heightCm");
  const hasNestedWeight =
    raw !== undefined && Object.prototype.hasOwnProperty.call(raw, "weightKg");

  const ageYears = hasNestedAge
    ? sanitizePositiveNumberDatum(raw?.ageYears)
    : undefined;
  const heightCm = hasNestedHeight
    ? sanitizePositiveNumberDatum(raw?.heightCm)
    : legacySelfReportedDatum(legacyHeightCm);
  const weightKg = hasNestedWeight
    ? sanitizePositiveNumberDatum(raw?.weightKg)
    : legacySelfReportedDatum(legacyWeightKg);

  if (!ageYears && !heightCm && !weightKg) return undefined;

  return {
    version: 1,
    ...(ageYears ? { ageYears } : {}),
    ...(heightCm ? { heightCm } : {}),
    ...(weightKg ? { weightKg } : {}),
  };
}

function serializePositiveNumberDatum(
  datum: HealthDatum<number> | undefined,
): Record<string, unknown> | null {
  const safe = sanitizePositiveNumberDatum(datum);
  if (!safe) return null;

  return {
    status: safe.status,
    value: safe.status === "known" ? safe.value ?? null : null,
    source: safe.source ?? null,
    recordedAt: safe.recordedAt ?? null,
  };
}

export function serializeHealthProfile(
  profile: HealthProfile | undefined,
): Record<string, unknown> | null {
  const safe = sanitizeHealthProfile(profile);
  if (!safe) return null;

  return {
    version: 1,
    ageYears: serializePositiveNumberDatum(safe.ageYears),
    heightCm: serializePositiveNumberDatum(safe.heightCm),
    weightKg: serializePositiveNumberDatum(safe.weightKg),
  };
}

export function cloneHealthProfile(
  profile: HealthProfile | undefined,
): HealthProfile | undefined {
  if (!profile) return undefined;
  return {
    version: 1,
    ...(profile.ageYears ? { ageYears: { ...profile.ageYears } } : {}),
    ...(profile.heightCm ? { heightCm: { ...profile.heightCm } } : {}),
    ...(profile.weightKg ? { weightKg: { ...profile.weightKg } } : {}),
  };
}

export function createSelfReportedHealthProfile(
  metrics: { ageYears?: number; heightCm?: number; weightKg?: number },
  recordedAt: string,
): HealthProfile | undefined {
  const timestamp = validRecordedAt(recordedAt);
  const ageYears = positiveFiniteNumber(metrics.ageYears);
  const heightCm = positiveFiniteNumber(metrics.heightCm);
  const weightKg = positiveFiniteNumber(metrics.weightKg);

  if (
    ageYears === undefined &&
    heightCm === undefined &&
    weightKg === undefined
  ) {
    return undefined;
  }

  const makeDatum = (value: number): HealthDatum<number> => ({
    status: "known",
    value,
    source: "self_reported",
    ...(timestamp ? { recordedAt: timestamp } : {}),
  });

  return {
    version: 1,
    ...(ageYears !== undefined ? { ageYears: makeDatum(ageYears) } : {}),
    ...(heightCm !== undefined ? { heightCm: makeDatum(heightCm) } : {}),
    ...(weightKg !== undefined ? { weightKg: makeDatum(weightKg) } : {}),
  };
}

export function getKnownHealthNumber(
  datum: HealthDatum<number> | undefined,
): number | undefined {
  if (datum?.status !== "known") return undefined;
  return positiveFiniteNumber(datum.value);
}
