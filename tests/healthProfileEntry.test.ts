import assert from "node:assert/strict";
import test from "node:test";
import { setSelfReportedHealthProfileField } from "../src/utils/healthProfileEntry";

const recordedAt = "2026-01-01T00:00:00Z";

test("creates an explicit self-reported datum", () => {
  const result = setSelfReportedHealthProfileField(undefined, "ageYears", {
    status: "known",
    value: 30,
    recordedAt,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.profile.ageYears?.source, "self_reported");
});

test("explicit unknown remains valueless", () => {
  const result = setSelfReportedHealthProfileField(undefined, "weightKg", {
    status: "unknown",
    recordedAt,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.profile.weightKg?.value, undefined);
});

test("invalid categorical value fails closed", () => {
  const result = setSelfReportedHealthProfileField(undefined, "activityCategory", {
    status: "known",
    value: "invalid",
    recordedAt,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid_entry");
});
