import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getStartupCloudSyncState } from "../src/utils/startupCloudSync";
import {
  getUserPantryCacheKey,
  parseUserPantryCache,
} from "../src/utils/startupPantryCache";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const firebaseSyncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8"
);
const pantryViewSource = readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url),
  "utf8"
);
const viteConfigSource = readFileSync(
  new URL("../vite.config.ts", import.meta.url),
  "utf8"
);
const runtimeQaGateSource = readFileSync(
  new URL("../src/qa/runtimeQaGate.ts", import.meta.url),
  "utf8"
);
const runtimeQaHarnessSource = readFileSync(
  new URL("../src/qa/StartupCloudSyncQaHarness.tsx", import.meta.url),
  "utf8"
);
const runtimeQaRunnerSource = readFileSync(
  new URL("../qa/runtime/startup-cloud-sync.mjs", import.meta.url),
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
  let startupState = getStartupCloudSyncState(false, null, snapshotOwnerId);
  let appBoundary = runAppSyncBoundary({
    ...startupState,
    loading: !startupState.canRenderApp,
    inventoryHydrated: false,
  });

  // The full-screen startup gate is allowed only while auth itself is unresolved.
  assert.equal(appBoundary.startupOverlayVisible, true);

  // Auth resolves while the inventory listener remains deliberately unresolved.
  // This is the reported failure window: the hook result must let App mount
  // immediately, label local inventory provisional, and reject a cloud overwrite.
  startupState = getStartupCloudSyncState(true, "user-1", snapshotOwnerId);
  appBoundary = runAppSyncBoundary({
    ...startupState,
    loading: !startupState.canRenderApp,
    inventoryHydrated: false,
  });
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


test("signed-in startup cache is scoped to the authenticated uid", () => {
  assert.equal(
    getUserPantryCacheKey("user-1"),
    "balkanbite_pantry_user_user-1"
  );
  assert.notEqual(
    getUserPantryCacheKey("user-1"),
    getUserPantryCacheKey("user-2")
  );
});

test("missing or malformed signed-in pantry cache stays unknown", () => {
  assert.equal(parseUserPantryCache(null), null);
  assert.equal(parseUserPantryCache("not-json"), null);
  assert.equal(parseUserPantryCache('{"id":"wrong-shape"}'), null);
});

test("valid user pantry cache is provisional data without invented fields", () => {
  const cached = [{
    id: "milk-1",
    name: "Milk",
    quantity: 1,
    unit: "L",
    category: "Dairy",
    addedAt: "2026-09-18",
  }];

  assert.deepEqual(parseUserPantryCache(JSON.stringify(cached)), cached);
  assert.deepEqual(parseUserPantryCache("[]"), []);
});

test("one invalid cached item invalidates the provisional cache", () => {
  const mixed = [
    {
      id: "rice-1",
      name: "Rice",
      quantity: 1,
      unit: "kg",
      category: "Pantry/Grains",
      addedAt: "2026-09-18",
    },
    {
      id: "broken",
      name: "Broken",
      quantity: 0,
      unit: "",
    },
  ];

  assert.equal(parseUserPantryCache(JSON.stringify(mixed)), null);
});

test("App swaps guest state for only the current user's provisional cache", () => {
  assert.match(
    appSource,
    /!inventoryHydrated\s*&&\s*pantryScope\s*!==\s*currentUser\.uid/
  );
  assert.match(
    appSource,
    /localStorage\.getItem\(getUserPantryCacheKey\(currentUser\.uid\)\)/
  );
  assert.match(
    appSource,
    /setPantry\(cachedUserPantry\s*\?\?\s*\[\]\)/
  );
});


test("provisional inventory stays read-only and non-authoritative in the UI", () => {
  assert.match(
    appSource,
    /const requireAuthoritativeInventory = \(\) => \{[\s\S]*if \(!inventoryIsProvisional\) return true;/
  );

  for (const handlerName of [
    "handleTransferToPantry",
    "handleGenerateAiRecipes",
    "handleGenerateAiShopping",
    "handleVoiceDeductItems",
  ]) {
    assert.match(
      appSource,
      new RegExp(
        `const ${handlerName} = [^\\n]*=> \\{\\n\\s*if \\(!requireAuthoritativeInventory\\(\\)\\) return;`
      )
    );
  }

  assert.match(
    appSource,
    /const handleCookRecipe = [^\\n]*=> \\{\\n\\s*if \\(!requireAuthoritativeInventory\\(\\)\\) \\{[\\s\\S]*return \\{ success: false, issueCount: 1 \\};/
  );

  assert.match(
    appSource,
    /shoppingUrgencyLevel=\{[\s\S]*inventoryIsProvisional \? undefined : shoppingDiagnostic\.urgencyLevel/
  );
  assert.match(
    appSource,
    /inventoryIsProvisional=\{inventoryIsProvisional\}/
  );
  assert.match(
    appSource,
    /\{!inventoryIsProvisional && \(\s*<SmartShoppingBanner/
  );

  assert.match(
    pantryViewSource,
    /inventoryIsProvisional \? "—" : pantry\.length/
  );
  assert.match(
    pantryViewSource,
    /inventoryIsProvisional \? "—" : expiringCount/
  );
  assert.match(
    pantryViewSource,
    /disabled=\{inventoryIsProvisional\}/
  );
});

test("runtime QA build marker uses Vercel SHA sources before git HEAD fallback", () => {
  assert.match(viteConfigSource, /VITE_VERCEL_GIT_COMMIT_SHA\?\.trim\(\)/);
  assert.match(viteConfigSource, /VERCEL_GIT_COMMIT_SHA\?\.trim\(\)/);
  assert.match(
    viteConfigSource,
    /execFileSync\('git', \['rev-parse', 'HEAD'\]/
  );
  assert.match(
    viteConfigSource,
    /__BALKANBITE_VERCEL_GIT_SHA__:\s*JSON\.stringify\(resolveBuildGitSha\(\)\)/
  );
});

test("hosted runtime QA binds the protected preview by fixed host and source fingerprint", () => {
  assert.match(
    runtimeQaGateSource,
    /balkanbite-git-preview-qa-agent-runtime-alejandrorastudini-6993\.vercel\.app/
  );
  assert.match(
    runtimeQaGateSource,
    /host === RUNTIME_QA_PREVIEW_HOST/
  );
  assert.match(runtimeQaGateSource, /host === "localhost"/);
  assert.match(runtimeQaGateSource, /host === "127\.0\.0\.1"/);
  assert.doesNotMatch(
    runtimeQaGateSource,
    /__BALKANBITE_VERCEL_ENV__ === "preview"/
  );
  assert.match(viteConfigSource, /function runtimeQaSourceFingerprint\(\)/);
  assert.match(viteConfigSource, /createHash\('sha256'\)/);
  assert.match(
    viteConfigSource,
    /__BALKANBITE_RUNTIME_QA_FINGERPRINT__:\s*JSON\.stringify\(/
  );
  assert.match(runtimeQaGateSource, /runtimeQaSourceFingerprint/);
  assert.match(runtimeQaHarnessSource, /data-testid="qa-source-fingerprint"/);
  assert.match(runtimeQaRunnerSource, /QA_EXPECTED_FINGERPRINT/);
  assert.match(runtimeQaRunnerSource, /lastSeenFingerprint === expectedFingerprint/);
  assert.match(
    runtimeQaRunnerSource,
    /getByTestId\("qa-runtime-root"\)[\s\S]*waitFor\(\{ state: "attached", timeout: 10_000 \}\)/
  );
  assert.match(
    runtimeQaRunnerSource,
    /getAttribute\("data-source-fingerprint"\)/
  );
  assert.match(
    runtimeQaRunnerSource,
    /QA_ALLOW_UNPROTECTED_LOCAL is restricted to localhost\/127\.0\.0\.1/
  );
});

