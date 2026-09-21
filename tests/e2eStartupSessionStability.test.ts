import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const profileSource = readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);
const firebaseSyncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("ProfileView cannot crash when progression summary is temporarily absent", () => {
  assert.match(
    profileSource,
    /progressionSummary\?: ProgressionActivitySummaryV1;/,
  );
  assert.match(
    profileSource,
    /const EMPTY_PROGRESSION_SUMMARY: ProgressionActivitySummaryV1 = \{[\s\S]*totalVerifiedEvents: 0,[\s\S]*confirmedPurchaseEvents: 0,[\s\S]*successfulCookEvents: 0,/,
  );
  assert.match(
    profileSource,
    /const safeProgressionSummary =\s*progressionSummary \?\? EMPTY_PROGRESSION_SUMMARY;/,
  );
  assert.doesNotMatch(
    profileSource,
    /\{progressionSummary\.totalVerifiedEvents\}/,
  );
  assert.match(
    appSource,
    /<ProfileView[\s\S]*progressionSummary=\{progressionSummary\}[\s\S]*theme=\{theme\}/,
  );
});

test("signed-in onboarding waits for the authoritative profile snapshot", () => {
  assert.match(
    appSource,
    /isOpen=\{\s*!showLanding\s*&&\s*\(!currentUser \|\| profileHydrated\)\s*&&\s*!profile\.onboardingCompleted\s*\}/,
  );
});

test("guest onboarding remains available without cloud profile hydration", () => {
  const condition =
    "!showLanding &&\n            (!currentUser || profileHydrated) &&\n            !profile.onboardingCompleted";
  assert.ok(appSource.includes(condition));
});

test("inventory hydration failure never authorizes cloud writes", () => {
  assert.match(
    firebaseSyncSource,
    /const \[inventorySyncErrorUser, setInventorySyncErrorUser\] = useState<string \| null>\(null\);/,
  );
  assert.match(
    firebaseSyncSource,
    /setInventorySyncErrorUser\(currentUser\.uid\);/,
  );
  assert.doesNotMatch(
    firebaseSyncSource,
    /setInventorySyncErrorUser\(currentUser\.uid\)[\s\S]{0,180}setInventoryHydratedUser\(currentUser\.uid\)/,
  );
  assert.match(
    firebaseSyncSource,
    /cloudInventoryWritesAllowed:[\s\S]*inventoryHydratedUser === currentUserId/,
  );
});

test("inventory listener has both timeout and explicit error exits from endless syncing", () => {
  assert.match(
    firebaseSyncSource,
    /setTimeout\(\(\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);[\s\S]*\}, 12_000\);/,
  );
  assert.match(
    firebaseSyncSource,
    /onSnapshot\(q, \(snapshot\) => \{[\s\S]*\}, \(error\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);/,
  );
});

test("a later successful inventory snapshot clears the failure and becomes authoritative", () => {
  const inventorySuccessIndex = firebaseSyncSource.indexOf(
    'if (collectionName === "inventory")',
    firebaseSyncSource.indexOf("const unsub = onSnapshot"),
  );
  const successBlock = firebaseSyncSource.slice(
    inventorySuccessIndex,
    inventorySuccessIndex + 320,
  );

  assert.match(successBlock, /clearInventoryHydrationTimeout\(\)/);
  assert.match(successBlock, /setInventorySyncErrorUser\(null\)/);
  assert.match(successBlock, /setInventoryHydratedUser\(currentUser\.uid\)/);
});

test("inventory sync failure is shown as read-only failure instead of a permanent syncing claim", () => {
  assert.match(
    appSource,
    /role=\{inventorySyncError \? "alert" : "status"\}/,
  );
  assert.match(
    appSource,
    /No se pudo sincronizar el inventario\. Tus datos locales siguen en modo solo lectura/,
  );
  assert.match(
    appSource,
    /Inventory sync failed\. Your local data remains read-only/,
  );
});
