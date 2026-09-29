import assert from "node:assert/strict";
import test from "node:test";
import { isServerConfirmedInventorySnapshot } from "../src/utils/inventorySnapshotAuthority";

test("only a server snapshot with no pending writes is authoritative", () => {
  assert.equal(isServerConfirmedInventorySnapshot({
    fromCache: false, hasPendingWrites: false,
  }), true);
});

test("cached inventory never advances signed-in authority", () => {
  assert.equal(isServerConfirmedInventorySnapshot({
    fromCache: true, hasPendingWrites: false,
  }), false);
});

test("latency-compensated local inventory never masquerades as committed stock", () => {
  assert.equal(isServerConfirmedInventorySnapshot({
    fromCache: false, hasPendingWrites: true,
  }), false);
  assert.equal(isServerConfirmedInventorySnapshot({
    fromCache: true, hasPendingWrites: true,
  }), false);
});
