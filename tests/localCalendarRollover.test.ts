import assert from "node:assert/strict";
import test from "node:test";
import { millisecondsUntilNextLocalDay } from "../src/utils/effectiveExpiry";

test("calendar rollover delay targets next local midnight", () => {
  assert.equal(
    millisecondsUntilNextLocalDay(new Date(2026, 9, 4, 23, 59, 30, 0)),
    30_000,
  );
});

test("invalid date cannot schedule rollover", () => {
  assert.equal(millisecondsUntilNextLocalDay(new Date(Number.NaN)), null);
});
