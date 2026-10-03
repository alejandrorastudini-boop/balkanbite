import assert from "node:assert/strict";
import test from "node:test";
import { deriveEffectiveExpiry } from "../src/utils/effectiveExpiry";

test("relative expiry ages deterministically with elapsed time", () => {
  const result = deriveEffectiveExpiry(
    3,
    "2026-10-01T12:00:00.000Z",
    new Date("2026-10-02T12:00:00.000Z"),
  );

  assert.deepEqual(result, {
    status: "known",
    expiresAt: "2026-10-04T12:00:00.000Z",
    daysRemaining: 2,
    expired: false,
  });
});

test("partial elapsed days do not prematurely consume a whole remaining day", () => {
  const result = deriveEffectiveExpiry(
    3,
    "2026-10-01T12:00:00.000Z",
    new Date("2026-10-02T00:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 3);
    assert.equal(result.expired, false);
  }
});

test("exact expiry instant is known zero days but not yet past expiry", () => {
  const result = deriveEffectiveExpiry(
    1,
    "2026-10-01T12:00:00.000Z",
    new Date("2026-10-02T12:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 0);
    assert.equal(result.expired, false);
  }
});

test("past expiry remains distinguishable from known zero", () => {
  const result = deriveEffectiveExpiry(
    1,
    "2026-10-01T12:00:00.000Z",
    new Date("2026-10-02T12:00:00.001Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 0);
    assert.equal(result.expired, true);
  }
});

test("unknown or invalid evidence never fabricates expiry", () => {
  assert.deepEqual(
    deriveEffectiveExpiry(undefined, "2026-10-01T12:00:00.000Z"),
    { status: "unknown" },
  );
  assert.deepEqual(
    deriveEffectiveExpiry(3, ""),
    { status: "unknown" },
  );
  assert.deepEqual(
    deriveEffectiveExpiry(-1, "2026-10-01T12:00:00.000Z"),
    { status: "unknown" },
  );
  assert.deepEqual(
    deriveEffectiveExpiry(Number.NaN, "2026-10-01T12:00:00.000Z"),
    { status: "unknown" },
  );
});

test("future capture clock skew never inflates confirmed shelf life", () => {
  const result = deriveEffectiveExpiry(
    3,
    "2026-10-02T12:00:00.000Z",
    new Date("2026-10-01T12:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 3);
    assert.equal(result.expired, false);
  }
});
