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
const profileMutationSource = readFileSync(
  new URL("../src/utils/profileMutationFirestore.ts", import.meta.url),
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
    /loading:\s*firebaseLoading,\s*inventoryHydrated,\s*inventoryIsProvisional,\s*inventorySyncError,\s*canRenderApp,/
  );
  assert.match(appSource, /id="app-root"/);
  assert.match(appSource, /\{!canRenderApp\s*&&\s*\(/);
  assert.match(firebaseSyncSource, /return\s*\{[\s\S]*canRenderApp,[\s\S]*loading:\s*!canRenderApp,/);
  assert.doesNotMatch(
    appSource,
    /if\s*\([^)]*!?inventoryHydrated[^)]*\)\s*\{?\s*return\s*\(/
  );
  assert.match(
    appSource,
    /activeTab === "pantry" && inventoryIsProvisional && profile\.onboardingCompleted/
  );
  assert.doesNotMatch(
    appSource,
    /fixed left-4 right-4 top-20 z-\[90\]/
  );

  assert.match(firebaseSyncSource, /getStartupCloudSyncState\(/);
  assert.match(firebaseSyncSource, /inventoryIsProvisional/);
  assert.match(
    firebaseSyncSource,
    /collectionName === "inventory" \|\|[\s\S]{0,160}!currentUser/
  );
  assert.match(firebaseSyncSource, /inventoryEditAuthority\.current/);
  assert.match(firebaseSyncSource, /inventoryServerConfirmedUser/);
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

test("provisional pantry cache preserves valid v1 lot state and rejects corrupt explicit lot state", () => {
  const valid = [{
    id: "milk-lot",
    name: "Milk",
    quantity: 1,
    unit: "L",
    category: "Dairy",
    addedAt: "2026-10-04",
    lotState: {
      version: 1,
      unallocatedQuantity: 1,
      activeLots: [],
    },
  }];
  assert.deepEqual(parseUserPantryCache(JSON.stringify(valid)), valid);

  const corrupt = [{
    ...valid[0],
    lotState: {
      version: 1,
      unallocatedQuantity: 0.5,
      activeLots: [],
    },
  }];
  assert.equal(parseUserPantryCache(JSON.stringify(corrupt)), null);

  const unsupported = [{
    ...valid[0],
    lotState: {
      version: 2,
      unallocatedQuantity: 1,
      activeLots: [],
    },
  }];
  assert.equal(parseUserPantryCache(JSON.stringify(unsupported)), null);
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
  // Authenticated provisional stock remains blocked; guest quarantine
  // additionally requires explicit human review before derived claims.
  assert.match(appSource, /const pantryDerivedDataProvisional\s*=\s*inventoryIsProvisional \|\| guestPantryReviewPending \|\| guestShoppingConsistencyProblem/);
  assert.match(
    appSource,
    /const requireAuthoritativeInventory = \(\) => \{[\s\S]*if \(!inventoryIsProvisional\) return true;/
  );

  for (const handlerName of [
    "handleAddPantryItem",
    "handleAddMultiplePantryItems",
    "handleTransferToPantry",
    "handleGenerateAiRecipes",
    "handleGenerateAiShopping",
    "handleVoiceDeductItems",
  ]) {
    assert.match(
      appSource,
      new RegExp(
        `const ${handlerName} = [\\s\\S]{0,240}?=> \\{\\n\\s*if \\(!requireAuthoritativeInventory\\(\\)\\) return(?: false)?;`
      )
    );
  }

  assert.match(
    appSource,
    /const handleCookRecipe = async \([\s\S]{0,180}?\): Promise<RecipeCookOutcome> => \{\n\s*if \(!requireAuthoritativeInventory\(\)\) \{[\s\S]*?return \{ success: false, issueCount: 1 \};/
  );

  assert.match(
    appSource,
    /shoppingUrgencyLevel=\{[\s\S]*pantryDerivedDataProvisional \? undefined : shoppingDiagnostic\.urgencyLevel/
  );
  assert.match(
    appSource,
    /inventoryIsProvisional=\{inventoryIsProvisional\}/
  );
  assert.match(
    appSource,
    /\{!pantryDerivedDataProvisional && \(\s*<SmartShoppingBanner/
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



test("auth transitions clear cloud-backed workspace before the next account hydrates", () => {
  assert.match(firebaseSyncSource, /authSessionUserId/);
  assert.match(
    firebaseSyncSource,
    /hydratedCollectionUser\.current = \{\};[\s\S]*setRecipes\(\[\]\);[\s\S]*setMealPlan\(\[\]\);[\s\S]*setShoppingList\(\[\]\);/
  );
  assert.match(
    firebaseSyncSource,
    /hydratedCollectionUser\.current\[collectionName\] !== currentUser\.uid/
  );
});

test("guest workspace storage is not overwritten by a signed-in account", () => {
  assert.match(
    appSource,
    /if \(isResetting \|\| currentUser \|\| workspaceScope !== "guest" \|\|\s*guestJournalRecoveryStatus !== "clear"\) return;\s*if \(blockLegacyGuestWriteForPendingJournal\(\)\) return;\s*try \{\s*const serialized = JSON\.stringify\(recipes\);\s*localStorage\.setItem\("balkanbite_recipes", serialized\)/
  );
  assert.match(
    appSource,
    /if \(isResetting \|\| currentUser \|\| workspaceScope !== "guest"\) return;[\s\S]*localStorage\.setItem\("balkanbite_meallogs"/
  );
  assert.match(
    appSource,
    /if \(isResetting \|\| currentUser \|\| workspaceScope !== "guest"\) return;[\s\S]*"balkanbite_chat_messages"/
  );
  assert.match(
    appSource,
    /if \(isResetting \|\| currentUser \|\| workspaceScope !== "guest" \|\|\s*guestJournalRecoveryStatus !== "clear"\) return;\s*if \(blockLegacyGuestWriteForPendingJournal\(\)\) return;\s*try \{\s*const serialized = JSON\.stringify\(mealPlan\);\s*localStorage\.setItem\("balkanbite_mealplan", serialized\)/
  );
  assert.doesNotMatch(appSource, /getUserLocalWorkspaceKey/);
});


test("profile Firestore writes serialize optional unknown fields instead of spreading undefined", () => {
  assert.match(
    profileMutationSource,
    /serializeUserProfileForFirestore\(initialProfile\)/
  );
  assert.match(
    profileMutationSource,
    /serializeUserProfileForFirestore\(nextProfile\)/
  );
  assert.doesNotMatch(
    firebaseSyncSource,
    /setDoc\(userDoc/
  );
  assert.doesNotMatch(
    firebaseSyncSource,
    /setDoc\(userDoc,\s*\{\s*\.\.\.profile/
  );
  assert.match(
    firebaseSyncSource,
    /Failed to create user profile/
  );
  assert.match(
    firebaseSyncSource,
    /submitProfileReplace/
  );
  assert.doesNotMatch(
    firebaseSyncSource,
    /Failed to save user profile/
  );
});


test("manual and batch pantry additions revalidate required fields at the App boundary", () => {
  const singleStart = appSource.indexOf("const handleAddPantryItem");
  const batchStart = appSource.indexOf("const handleAddMultiplePantryItems");
  const updateStart = appSource.indexOf("const handleUpdatePantryQuantity");

  assert.ok(singleStart >= 0 && batchStart > singleStart && updateStart > batchStart);

  const single = appSource.slice(singleStart, batchStart);
  const batch = appSource.slice(batchStart, updateStart);

  assert.match(single, /hasValidPantryAcquisitionRequiredFields\(item\)/);
  assert.match(batch, /isValidPantryAcquisitionBatch\(items\)/);
  assert.match(batch, /if \(!isValidPantryAcquisitionBatch\(items\)\) return false;/);
  assert.ok(
    batch.indexOf("isValidPantryAcquisitionBatch(items)") <
      batch.indexOf("items.map"),
    "batch validation must happen before authoritative pantry rows are created",
  );
});

test("provisional signed-in cache rejects incomplete fields without inventing replacements", () => {
  const valid = {
    id: "owner-rice-1",
    name: "Rice",
    quantity: 1,
    unit: "kg",
    category: "Pantry/Grains",
    addedAt: "2026-10-15",
  };
  assert.deepEqual(parseUserPantryCache(JSON.stringify([valid])), [valid]);

  for (const invalid of [
    { ...valid, category: undefined },
    { ...valid, category: "MadeUp" },
    { ...valid, addedAt: undefined },
    { ...valid, addedAt: "" },
    { ...valid, id: " " },
    { ...valid, id: "unbounded-" + "x".repeat(301) },
  ]) {
    assert.equal(parseUserPantryCache(JSON.stringify([invalid])), null);
  }
  assert.equal(parseUserPantryCache(JSON.stringify([[valid]])), null);
  // A mixed list is wholly provisional/unknown; never silently trim rows
  // and pretend the remainder is the full remote inventory.
  assert.equal(parseUserPantryCache(JSON.stringify([valid, { id: "incomplete" }])), null);
});

test("duplicate logical identities invalidate an owner-scoped provisional pantry cache", () => {
  const rice = {
    id: "logical-rice",
    name: "Rice",
    quantity: 1,
    unit: "kg",
    category: "Pantry/Grains",
    addedAt: "2026-10-15",
  };
  const sameIdDifferentStock = { ...rice, quantity: 3, name: "Rice variant" };
  assert.equal(parseUserPantryCache(JSON.stringify([rice, { ...rice }])), null);
  assert.equal(parseUserPantryCache(JSON.stringify([rice, sameIdDifferentStock])), null);
  assert.deepEqual(
    parseUserPantryCache(JSON.stringify([rice, { ...rice, id: "other-rice" }])),
    [rice, { ...rice, id: "other-rice" }],
  );
});


test("independent guest derived readback failures remain fail-closed even if shopping later succeeds", () => {
  assert.match(appSource, /const guestShoppingConsistencyProblem\s*=\s*guestDerivedShoppingRecoveryProblem \|\| guestDerivedStorageWriteFailed/);
  for (const key of ["balkanbite_recipes", "balkanbite_mealplan", "balkanbite_progression"]) {
    const writer = appSource.indexOf(`localStorage.setItem("${key}", serialized)`);
    assert.ok(writer >= 0, `${key} must have explicit guest storage write`);
    const context = appSource.slice(writer, writer + 450);
    assert.match(context, new RegExp(`localStorage\\.getItem\\("${key}"\\) !== serialized`));
    assert.match(context, /setGuestDerivedStorageWriteFailed\(true\)/);
  }
  assert.match(appSource, /guestShoppingReviewRequired\s*&&\s*\(/);
  assert.match(appSource, /if \(!currentUser && guestShoppingReviewRequired\)/);
  assert.doesNotMatch(appSource, /setGuestDerivedStorageWriteFailed\(false\)/,
    "only explicit rehydration/recovery may clear unrelated failures, never shopping success");
});
