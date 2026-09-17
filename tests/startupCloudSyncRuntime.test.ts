import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getStartupCloudSyncState } from "../src/utils/startupCloudSync";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const firebaseSyncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8"
);

type AppSyncBoundary = ReturnType<typeof getStartupCloudSyncState> & {
  loading: boolean;
  inventoryHydrated: boolean;
};

function runAppSyncBoundary(sync: AppSyncBoundary) {
  let cloudWrites = 0;

  return {
    // Mirrors the App boundary: the root mounts independently of inventory
    // hydration, while only the full startup overlay follows canRenderApp.
    appRootMounted: true,
    hookReportsLoading: sync.loading,
    startupOverlayVisible: !sync.canRenderApp,
    provisionalInventoryNoticeVisible: sync.inventoryIsProvisional,
    inventoryHydrated: sync.inventoryHydrated,
    attemptInventoryWrite() {
      if (sync.cloudInventoryWritesAllowed) cloudWrites += 1;
      return cloudWrites;
    },
  };
}

test("delayed first inventory snapshot crosses the hook/App boundary without gating the shell", async () => {
  let resolveFirstSnapshot!: (ownerId: string) => void;
  const firstSnapshot = new Promise<string>((resolve) => {
    resolveFirstSnapshot = resolve;
  });

  let snapshotOwnerId: string | null = null;
  let startupState = getStartupCloudSyncState(true, "user-1", snapshotOwnerId);
  let appBoundary = runAppSyncBoundary({
    ...startupState,
    loading: !startupState.canRenderApp,
    inventoryHydrated: false,
  });

  // Enter startup while the listener is deliberately unresolved. This is the
  // reported failure window: the hook result must let App mount immediately,
  // label local inventory provisional, and reject an attempted cloud overwrite.
  assert.deepEqual(startupState, {
    canRenderApp: true,
    inventoryIsProvisional: true,
    cloudInventoryWritesAllowed: false,
  });
  assert.deepEqual(
    {
      appRootMounted: appBoundary.appRootMounted,
      startupOverlayVisible: appBoundary.startupOverlayVisible,
      provisionalInventoryNoticeVisible:
        appBoundary.provisionalInventoryNoticeVisible,
      inventoryHydrated: appBoundary.inventoryHydrated,
    },
    {
      appRootMounted: true,
      startupOverlayVisible: false,
      provisionalInventoryNoticeVisible: true,
      inventoryHydrated: false,
    }
  );
  assert.equal(appBoundary.attemptInventoryWrite(), 0);

  snapshotOwnerId = await (async () => {
    resolveFirstSnapshot("user-1");
    return firstSnapshot;
  })();
  startupState = getStartupCloudSyncState(true, "user-1", snapshotOwnerId);
  appBoundary = runAppSyncBoundary({
    ...startupState,
    loading: !startupState.canRenderApp,
    inventoryHydrated: true,
  });

  assert.deepEqual(startupState, {
    canRenderApp: true,
    inventoryIsProvisional: false,
    cloudInventoryWritesAllowed: true,
  });
  assert.equal(appBoundary.provisionalInventoryNoticeVisible, false);
  assert.equal(appBoundary.inventoryHydrated, true);
  assert.equal(appBoundary.attemptInventoryWrite(), 1);
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

test("an account switch remains usable but provisional until its own first snapshot", () => {
  const previousAccount = getStartupCloudSyncState(true, "user-1", "user-1");
  assert.equal(previousAccount.cloudInventoryWritesAllowed, true);

  const switchedAccountBeforeSnapshot = getStartupCloudSyncState(
    true,
    "user-2",
    "user-1"
  );
  const appBoundary = runAppSyncBoundary({
    ...switchedAccountBeforeSnapshot,
    loading: !switchedAccountBeforeSnapshot.canRenderApp,
    inventoryHydrated: false,
  });

  assert.deepEqual(switchedAccountBeforeSnapshot, {
    canRenderApp: true,
    inventoryIsProvisional: true,
    cloudInventoryWritesAllowed: false,
  });
  assert.equal(appBoundary.appRootMounted, true);
  assert.equal(appBoundary.startupOverlayVisible, false);
  assert.equal(appBoundary.provisionalInventoryNoticeVisible, true);
  assert.equal(appBoundary.attemptInventoryWrite(), 0);
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
