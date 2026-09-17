import assert from "node:assert/strict";
import test from "node:test";
import { getStartupCloudSyncState } from "../src/utils/startupCloudSync";

test("delayed first inventory snapshot does not hold the whole application", () => {
  const beforeAuth = getStartupCloudSyncState(false, null, null);
  assert.equal(beforeAuth.canRenderApp, false);

  const delayedSnapshot = getStartupCloudSyncState(true, "user-1", null);
  assert.deepEqual(delayedSnapshot, {
    canRenderApp: true,
    inventoryIsProvisional: true,
    cloudInventoryWritesAllowed: false,
  });
});

test("the matching first inventory snapshot makes inventory authoritative", () => {
  const hydrated = getStartupCloudSyncState(true, "user-1", "user-1");
  assert.deepEqual(hydrated, {
    canRenderApp: true,
    inventoryIsProvisional: false,
    cloudInventoryWritesAllowed: true,
  });
});

test("a previous session's inventory snapshot cannot authorize the current session", () => {
  const staleSnapshot = getStartupCloudSyncState(true, "user-2", "user-1");
  assert.deepEqual(staleSnapshot, {
    canRenderApp: true,
    inventoryIsProvisional: true,
    cloudInventoryWritesAllowed: false,
  });
});

test("guest startup is usable without claiming cloud inventory authority", () => {
  const guest = getStartupCloudSyncState(true, null, null);
  assert.deepEqual(guest, {
    canRenderApp: true,
    inventoryIsProvisional: false,
    cloudInventoryWritesAllowed: false,
  });
});
