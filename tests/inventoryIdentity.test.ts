import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeInventoryLogicalId,
  isSafeInventoryProvenanceId,
} from "../src/utils/inventoryIdentity";

test("purchase-generated logical pantry IDs are valid application identities", () => {
  for (const id of [
    "purchase-shopping:s2",
    "purchase-reconcile:rec-123:extra:0",
    "p-1727600000000",
    "legacy:tomato",
  ]) {
    assert.equal(isSafeInventoryLogicalId(id), true, id);
  }
});

test("logical pantry IDs stay bounded, trim-stable and control-free", () => {
  for (const id of [
    "",
    " ",
    " leading",
    "trailing ",
    "line\nbreak",
    "control\u0000id",
    "x".repeat(301),
  ]) {
    assert.equal(isSafeInventoryLogicalId(id), false, JSON.stringify(id));
  }
  assert.equal(isSafeInventoryLogicalId("x".repeat(300)), true);
});

test("purchase provenance IDs preserve shopping/reconcile separators safely", () => {
  for (const id of [
    "shopping:s1",
    "reconcile:rec-123:extra:0",
    "legacy:purchase-shopping:s2",
  ]) {
    assert.equal(isSafeInventoryProvenanceId(id), true, id);
  }
  assert.equal(isSafeInventoryProvenanceId("bad\nid"), false);
  assert.equal(isSafeInventoryProvenanceId("x".repeat(401)), false);
});
