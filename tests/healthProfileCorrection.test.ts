import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeHealthProfile } from "../src/utils/healthProfile";
import { correctExistingHealthProfileField } from "../src/utils/healthProfileCorrection";

const BASE_PROFILE = sanitizeHealthProfile({
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
  activityCategory: {
    status: "known",
    value: "moderately_active",
    source: "imported",
    recordedAt: "2026-09-20T09:10:00.000Z",
  },
});

test("correcting an existing numeric health field replaces only that datum", () => {
  const result = correctExistingHealthProfileField(BASE_PROFILE, "ageYears", {
    status: "known",
    value: 36,
    recordedAt: "2026-09-20T13:20:00.000Z",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.profile.ageYears, {
    status: "known",
    value: 36,
    source: "self_reported",
    recordedAt: "2026-09-20T13:20:00.000Z",
  });
  assert.deepEqual(result.profile.heightCm, BASE_PROFILE?.heightCm);
  assert.deepEqual(result.profile.activityCategory, BASE_PROFILE?.activityCategory);
});

test("correction can explicitly replace a known value with a non-known state", () => {
  const result = correctExistingHealthProfileField(
    BASE_PROFILE,
    "activityCategory",
    {
      status: "prefer_not_to_say",
      value: "very_active",
      recordedAt: "2026-09-20T13:21:00.000Z",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.profile.activityCategory, {
    status: "prefer_not_to_say",
    source: "self_reported",
    recordedAt: "2026-09-20T13:21:00.000Z",
  });
});

test("correction cannot add a missing HealthProfile field", () => {
  const result = correctExistingHealthProfileField(BASE_PROFILE, "weightKg", {
    status: "known",
    value: 80,
    recordedAt: "2026-09-20T13:22:00.000Z",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "field_absent",
    profile: BASE_PROFILE,
  });
  assert.equal(result.profile?.weightKg, undefined);
});

test("invalid known correction never deletes the existing datum", () => {
  const result = correctExistingHealthProfileField(BASE_PROFILE, "ageYears", {
    status: "known",
    value: 0,
    recordedAt: "2026-09-20T13:23:00.000Z",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "invalid_correction",
    profile: BASE_PROFILE,
  });
  assert.equal(result.profile?.ageYears?.value, 35);
});

test("invalid categorical correction never becomes a health fact", () => {
  const result = correctExistingHealthProfileField(
    BASE_PROFILE,
    "activityCategory",
    {
      status: "known",
      value: "sedentary",
      recordedAt: "2026-09-20T13:24:00.000Z",
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_correction");
  assert.deepEqual(result.profile?.activityCategory, BASE_PROFILE?.activityCategory);
});

test("correction rejects an invalid recordedAt instead of silently dropping provenance time", () => {
  const result = correctExistingHealthProfileField(BASE_PROFILE, "heightCm", {
    status: "known",
    value: 176,
    recordedAt: "not-a-date",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_recorded_at");
  assert.deepEqual(result.profile?.heightCm, BASE_PROFILE?.heightCm);
});

test("correction reports an absent profile without inventing state", () => {
  const result = correctExistingHealthProfileField(undefined, "ageYears", {
    status: "unknown",
    recordedAt: "2026-09-20T13:25:00.000Z",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "profile_absent",
    profile: undefined,
  });
});
