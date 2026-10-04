import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("signed-in single pantry creation dispatches transaction without optimistic pantry mutation", () => {
  const start = appSource.indexOf("const handleAddPantryItem");
  const end = appSource.indexOf("const handleAddMultiplePantryItems", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(
    handler,
    /if \(currentUser\) \{\s*return dispatchSignedInPantryCreations\(\[newItem\]\);\s*\}/,
  );
  const signedIn = handler.slice(handler.indexOf("if (currentUser)"), handler.indexOf("updatePantryAndReconcileMenu"));
  assert.doesNotMatch(signedIn, /setPantry\(/);
  assert.match(handler, /updatePantryAndReconcileMenu\(\[newItem\], true\)/);
});

test("signed-in scan or receipt batch uses one atomic creation dispatch while guest path remains local", () => {
  const start = appSource.indexOf("const handleAddMultiplePantryItems");
  const end = appSource.indexOf("const dispatchVerifiedPantryChange", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(
    handler,
    /if \(currentUser\) \{\s*return dispatchSignedInPantryCreations\(newItems\);\s*\}/,
  );
  assert.match(handler, /updatePantryAndReconcileMenu\(newItems, true\)/);
});

test("signed-in creation records pending IDs before writer dispatch and never calls setPantry", () => {
  const start = appSource.indexOf("const dispatchSignedInPantryCreations");
  const end = appSource.indexOf("const shoppingDiagnostic", start);
  assert.ok(start >= 0 && end > start);
  const dispatch = appSource.slice(start, end);
  const pendingIndex = dispatch.indexOf("pendingSignedInCreations.current = { userId: uid, ids }");
  const submitIndex = dispatch.indexOf("submitInventoryCreations(items)");
  assert.ok(pendingIndex >= 0 && submitIndex > pendingIndex);
  assert.doesNotMatch(dispatch, /setPantry\(/);
  assert.match(dispatch, /pendingSignedInCreations\.current = null;/);
  assert.match(dispatch, /Signed-in pantry creation failed/);
});

test("derived menu state waits until every confirmed created ID is visible in owner pantry snapshot", () => {
  const marker = "Signed-in creation never mutates pantry optimistically";
  const start = appSource.indexOf(marker);
  const end = appSource.indexOf("const dispatchSignedInPantryCreations", start);
  assert.ok(start >= 0 && end > start);
  const effect = appSource.slice(start, end);
  assert.match(effect, /if \(!inventoryHydrated \|\| !inventoryServerConfirmed\) return;/);
  assert.match(effect, /const visibleIds = new Set\(pantry\.map\(item => item\.id\)\)/);
  assert.match(effect, /if \(!\[\.\.\.pending\.ids\]\.every\(id => visibleIds\.has\(id\)\)\) return;/);
  assert.match(effect, /pendingSignedInCreations\.current = null;/);
  assert.match(effect, /submitRecipesReplace\(recipes, syncedRecipes\)/);
  assert.match(effect, /submitMealPlanReplace\(mealPlan, newPlan\)/);
});

test("sync hook uses creation primitive with current signed-in owner and has an in-flight guard", () => {
  const start = syncSource.indexOf("const submitInventoryCreations");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const submit = syncSource.slice(start, end);
  assert.match(submit, /inventoryHydratedUser !== uid/);
  assert.match(submit, /authSessionUserId\.current !== uid/);
  assert.match(submit, /inventoryCreationInFlight\.current/);
  assert.match(submit, /persistNewInventoryItems\(db, uid, items\)/);
  assert.doesNotMatch(submit, /setPantry\(/);
});

test("signed-in voice pantry addition awaits the same confirmed creation path while guest remains local", () => {
  const start = appSource.indexOf("const handleVoiceAddItems");
  const end = appSource.indexOf("const handleVoiceAddShoppingItems", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);
  assert.match(handler, /const handleVoiceAddItems = async/);
  assert.match(handler, /if \(!requireAuthoritativeInventory\(\)\) return false;/);
  assert.match(
    handler,
    /if \(currentUser\) \{\s*return dispatchSignedInPantryCreations\(parsed\);\s*\}/,
  );
  assert.match(handler, /return updatePantryAndReconcileMenu\(parsed, true\);/);
});

test("inventory server confirmation requires non-cache snapshot with zero pending writes", () => {
  assert.match(
    syncSource,
    /isServerConfirmedInventorySnapshot\(snapshot\.metadata\)[\s\S]*snapshot\.docs\.every\(snapshotDoc => snapshotDoc\.metadata\.hasPendingWrites === false\)/,
  );
  assert.match(
    syncSource,
    /setInventoryServerConfirmedUser\(serverConfirmed \? currentUser\.uid : null\)/,
  );
  assert.match(
    syncSource,
    /setInventoryServerConfirmedUser\(null\);[\s\S]*inventoryEditAuthority\.current = \{/,
  );
});


test("inventory creation serializer preserves only invariant-valid explicit lot state", () => {
  const source = readFileSync(
    new URL("../src/utils/inventoryCreationFirestore.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /inventoryLotStateMatchesQuantity\(item\.quantity, item\.unit, item\.lotState\)/);
  assert.match(source, /if \(item\.lotState !== undefined\) \{\s*out\.lotState = item\.lotState;/);
});
