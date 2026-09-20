import assert from "node:assert/strict";
import test from "node:test";
import {
  createSelfReportedHealthProfile,
  getKnownHealthNumber,
  removeHealthProfileField,
  sanitizeHealthProfile,
  serializeHealthProfile,
} from "../src/utils/healthProfile";

const hasUndefinedDeep = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefinedDeep);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasUndefinedDeep);
  }
  return false;
};

test("self-reported body metrics carry provenance and measurement time", () => {
  const profile = createSelfReportedHealthProfile(
    { ageYears: 34, heightCm: 180, weightKg: 81.5 },
    "2026-09-20T07:00:00.000Z",
  );

  assert.deepEqual(profile, {
    version: 1,
    ageYears: {
      status: "known",
      value: 34,
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    heightCm: {
      status: "known",
      value: 180,
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    weightKg: {
      status: "known",
      value: 81.5,
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
  });
});

test("health profile supports explicit non-known states without inventing values", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    heightCm: {
      status: "prefer_not_to_say",
      source: "self_reported",
      recordedAt: "2026-09-20T07:00:00.000Z",
    },
    weightKg: {
      status: "unknown",
    },
  });

  assert.equal(profile?.heightCm?.status, "prefer_not_to_say");
  assert.equal(profile?.heightCm?.value, undefined);
  assert.equal(profile?.weightKg?.status, "unknown");
  assert.equal(getKnownHealthNumber(profile?.heightCm), undefined);
  assert.equal(getKnownHealthNumber(profile?.weightKg), undefined);
});

test("legacy flat body metrics migrate into HealthProfile without fabrication", () => {
  const profile = sanitizeHealthProfile(undefined, 175, 70);

  assert.equal(profile?.version, 1);
  assert.deepEqual(profile?.heightCm, {
    status: "known",
    value: 175,
    source: "self_reported",
  });
  assert.deepEqual(profile?.weightKg, {
    status: "known",
    value: 70,
    source: "self_reported",
  });
});

test("explicit nested unknowns take precedence over stale legacy flat values", () => {
  const profile = sanitizeHealthProfile(
    {
      version: 1,
      heightCm: null,
      weightKg: { status: "unknown" },
    },
    190,
    100,
  );

  assert.equal(profile?.heightCm, undefined);
  assert.equal(profile?.weightKg?.status, "unknown");
});

test("HealthProfile serialization never emits undefined, including nested fields", () => {
  const profile = createSelfReportedHealthProfile(
    { heightCm: 182.5 },
    "not-a-date",
  );
  const serialized = serializeHealthProfile(profile);

  assert.equal(hasUndefinedDeep(serialized), false);
  assert.deepEqual(serialized, {
    version: 1,
    ageYears: null,
    heightCm: {
      status: "known",
      value: 182.5,
      source: "self_reported",
      recordedAt: null,
    },
    weightKg: null,
    physiologicalSex: null,
    activityCategory: null,
    pregnancyLactationStatus: null,
  });
});


test("HealthProfile preserves explicit categorical energy inputs and provenance", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    physiologicalSex: {
      status: "known",
      value: "female",
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    activityCategory: {
      status: "known",
      value: "moderately_active",
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    pregnancyLactationStatus: {
      status: "prefer_not_to_say",
      source: "self_reported",
    },
  });

  assert.equal(profile?.physiologicalSex?.value, "female");
  assert.equal(profile?.activityCategory?.value, "moderately_active");
  assert.equal(profile?.pregnancyLactationStatus?.status, "prefer_not_to_say");
  assert.equal(profile?.pregnancyLactationStatus?.value, undefined);
});

test("invalid categorical energy values are not converted into health facts", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    physiologicalSex: {
      status: "known",
      value: "unknown-from-ai",
      source: "estimated",
    },
    activityCategory: {
      status: "known",
      value: "sedentary",
      source: "estimated",
    },
  });

  assert.equal(profile, undefined);
});


test("field removal preserves other HealthProfile data and provenance", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    ageYears: {
      status: "known",
      value: 35,
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    heightCm: {
      status: "known",
      value: 175,
      source: "measured",
      recordedAt: "2026-09-20T09:05:00.000Z",
    },
  });

  const next = removeHealthProfileField(profile, "ageYears");

  assert.equal(next?.ageYears, undefined);
  assert.deepEqual(next?.heightCm, {
    status: "known",
    value: 175,
    source: "measured",
    recordedAt: "2026-09-20T09:05:00.000Z",
  });
});

test("removing the final HealthProfile datum makes the profile absent", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    pregnancyLactationStatus: {
      status: "prefer_not_to_say",
      source: "self_reported",
    },
  });

  assert.equal(
    removeHealthProfileField(profile, "pregnancyLactationStatus"),
    undefined,
  );
});

test("removing a missing field does not create unknown/default health data", () => {
  const profile = sanitizeHealthProfile({
    version: 1,
    weightKg: {
      status: "unknown",
      source: "self_reported",
    },
  });

  assert.deepEqual(removeHealthProfileField(profile, "heightCm"), profile);
});
