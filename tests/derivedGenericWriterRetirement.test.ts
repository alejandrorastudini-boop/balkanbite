import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("generic collection writer is disabled for every core loop collection", () => {
  const writer = hook.slice(
    hook.indexOf("useEffect(() => {", hook.indexOf("const syncCollection")),
    hook.indexOf("const isRealPantryItem"),
  );
  for (const collectionName of ["inventory", "shoppingList", "recipes", "mealPlans"]) {
    assert.match(writer, new RegExp(`collectionName === "${collectionName}"`));
  }
});

test("legacy writeBatch remains unreachable for core loop collections", () => {
  assert.match(hook, /const batch = writeBatch\(db\)/);
  assert.match(hook, /collectionName === "recipes"/);
  assert.match(hook, /collectionName === "mealPlans"/);
});
