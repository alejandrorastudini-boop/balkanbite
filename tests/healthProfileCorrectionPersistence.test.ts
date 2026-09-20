import assert from "node:assert/strict";
import test from "node:test";
import { correctExistingHealthProfileField } from "../src/utils/healthProfileCorrection";
import {
  sanitizeRemoteUserProfile,
  serializeUserProfileForFirestore,
} from "../src/utils/profileSyncBoundary";

test("corrected HealthProfile datum persists with fresh self-reported provenance and preserves siblings", () => {
  const profile = sanitizeRemoteUserProfile({
    name: "Alex",
    healthProfile: {
      version: 1,
      ageYears: {
        status: "known",
        value: 35,
        source: "imported",
        recordedAt: "2026-09-20T09:00:00.000Z",
      },
      heightCm: {
        status: "known",
        value: 175,
        source: "measured",
        recordedAt: "2026-09-20T09:05:00.000Z",
      },
    },
  });

  const correction = correctExistingHealthProfileField(
    profile.healthProfile,
    "ageYears",
    {
      status: "known",
      value: 36,
      recordedAt: "2026-09-20T13:30:00.000Z",
    },
  );

  assert.equal(correction.ok, true);
  if (!correction.ok) return;

  const serialized = serializeUserProfileForFirestore({
    ...profile,
    healthProfile: correction.profile,
  });
  const cloudHealth = serialized.healthProfile as Record<string, unknown>;

  assert.deepEqual(cloudHealth.ageYears, {
    status: "known",
    value: 36,
    source: "self_reported",
    recordedAt: "2026-09-20T13:30:00.000Z",
  });
  assert.deepEqual(cloudHealth.heightCm, {
    status: "known",
    value: 175,
    source: "measured",
    recordedAt: "2026-09-20T09:05:00.000Z",
  });
  assert.equal(cloudHealth.weightKg, null);
});
