import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveEffectiveExpiry,
  derivePantryItemExpiry,
} from "../src/utils/effectiveExpiry";

test("relative expiry ages by calendar day from persisted date provenance", () => {
  assert.deepEqual(
    deriveEffectiveExpiry(
      3,
      "2026-10-01",
      new Date("2026-10-02T23:59:59.000Z"),
    ),
    {
      status: "known",
      expiresOn: "2026-10-04",
      daysRemaining: 2,
      expired: false,
    },
  );
});

test("time of day does not invent hour-level precision", () => {
  const morning = deriveEffectiveExpiry(
    3,
    "2026-10-01",
    new Date("2026-10-02T00:00:01.000Z"),
  );
  const evening = deriveEffectiveExpiry(
    3,
    "2026-10-01",
    new Date("2026-10-02T23:59:59.000Z"),
  );

  assert.deepEqual(morning, evening);
});

test("entered expiry day is known zero but not yet past", () => {
  const result = deriveEffectiveExpiry(
    1,
    "2026-10-01",
    new Date("2026-10-02T23:59:59.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.expiresOn, "2026-10-02");
    assert.equal(result.daysRemaining, 0);
    assert.equal(result.expired, false);
  }
});

test("following calendar day is distinguishable as past entered expiry", () => {
  const result = deriveEffectiveExpiry(
    1,
    "2026-10-01",
    new Date("2026-10-03T00:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 0);
    assert.equal(result.expired, true);
  }
});

test("unknown, invalid or unsupported fractional evidence never fabricates expiry", () => {
  for (const [days, capturedAt] of [
    [undefined, "2026-10-01"],
    [3, ""],
    [-1, "2026-10-01"],
    [Number.NaN, "2026-10-01"],
    [0.5, "2026-10-01"],
  ] as const) {
    assert.deepEqual(
      deriveEffectiveExpiry(days, capturedAt),
      { status: "unknown" },
    );
  }
});

test("future capture clock skew never inflates confirmed shelf life", () => {
  const result = deriveEffectiveExpiry(
    3,
    "2026-10-02",
    new Date("2026-10-01T12:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 3);
    assert.equal(result.expired, false);
  }
});

test("non-partial pantry expiry ages from item addedAt", () => {
  const result = derivePantryItemExpiry(
    {
      expiryDaysLeft: 3,
      addedAt: "2026-10-01",
    },
    new Date("2026-10-03T12:00:00.000Z"),
  );

  assert.equal(result.status, "known");
  if (result.status === "known") {
    assert.equal(result.daysRemaining, 1);
    assert.equal(result.expired, false);
  }
});

test("partial merged pantry expiry stays unknown instead of claiming one lot remains", () => {
  assert.deepEqual(
    derivePantryItemExpiry(
      {
        expiryDaysLeft: 1,
        addedAt: "2026-10-01",
        expiryIsPartial: true,
      },
      new Date("2026-10-03T12:00:00.000Z"),
    ),
    { status: "unknown" },
  );
});
