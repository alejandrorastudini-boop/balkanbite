import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getStartupCloudSyncState } from "../src/utils/startupCloudSync";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const firebaseSyncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8"
);

test("delayed first inventory snapshot keeps the startup state usable and write-safe", async () => {
  let resolveFirstSnapshot!: (ownerId: string) => void;
  const firstSnapshot = new Promise<string>((resolve) => {
    resolveFirstSnapshot = resolve;
  });

  let snapshotOwnerId: string | null = null;
  let startupState = getStartupCloudSyncState(true, "user-1", snapshotOwnerId);
  let cloudWrites = 0;
  const attemptCloudWrite = () => {
    if (startupState.cloudInventoryWritesAllowed) cloudWrites += 1;
  };

  // Enter startup while the listener is deliberately unresolved. This is the
  // reported failure window: the shell must be available without presenting local
  // inventory as authoritative or permitting it to overwrite cloud inventory.
  assert.deepEqual(startupState, {
    canRenderApp: true,
    inventoryIsProvisional: true,
    cloudInventoryWritesAllowed: false,
  });
  attemptCloudWrite();
  assert.equal(cloudWrites, 0);

  snapshotOwnerId = await (async () => {
    resolveFirstSnapshot("user-1");
    return firstSnapshot;
  })();
  startupState = getStartupCloudSyncState(true, "user-1", snapshotOwnerId);

  assert.deepEqual(startupState, {
    canRenderApp: true,
    inventoryIsProvisional: false,
    cloudInventoryWritesAllowed: true,
  });
  attemptCloudWrite();
  assert.equal(cloudWrites, 1);
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

test("App wiring keeps the shell independent from delayed inventory and gates cloud writes", () => {
  // This is deliberately a wiring contract rather than another isolated state-helper
  // assertion: a future App/hook refactor must keep all three runtime connections.
  assert.match(
    appSource,
    /loading:\s*firebaseLoading,\s*inventoryHydrated,\s*inventoryIsProvisional,\s*canRenderApp,/
  );
  assert.match(appSource, /id="app-root"/);
  assert.match(appSource, /\{!canRenderApp\s*&&\s*\(/);
  assert.match(firebaseSyncSource, /return\s*\{[\s\S]*canRenderApp,[\s\S]*loading:\s*!canRenderApp,/);
  assert.doesNotMatch(
    appSource,
    /if\s*\([^)]*!?inventoryHydrated[^)]*\)\s*\{?\s*return\s*\(/
  );
  assert.match(appSource, /\{inventoryIsProvisional\s*&&\s*\(/);

  assert.match(firebaseSyncSource, /getStartupCloudSyncState\(/);
  assert.match(firebaseSyncSource, /cloudInventoryWritesAllowed/);
  assert.match(
    firebaseSyncSource,
    /if\s*\([^)]*!cloudInventoryWritesAllowed[^)]*\)\s*return/
  );
});
