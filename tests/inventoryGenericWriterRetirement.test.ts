import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sync = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("generic inventory sync is hydration-only and returns before generic writer", () => {
  const helper = sync.slice(
    sync.indexOf("// Sync Collection Helper"),
    sync.indexOf("// A capture returns"),
  );
  const readGate = helper.indexOf('if (collectionName === "inventory") {\n      return;');
  const writer = helper.indexOf("const batch = writeBatch(db)");
  assert.ok(readGate > 0, "inventory read-only gate must exist");
  assert.ok(writer > readGate, "generic writer must be unreachable for inventory");
});

test("legacy bulk inventory tombstone synthesis is gone", () => {
  assert.equal(sync.includes("deletedInventoryIds"), false);
  assert.equal(sync.includes("hydratedInventoryActiveIds"), false);
  assert.equal(sync.includes("currentInventoryIds"), false);
});

test("secondary cloud collections retain generic batch sync", () => {
  assert.ok(sync.includes("const batch = writeBatch(db)"));
  assert.ok(sync.includes("deletedCollectionDocumentIds.forEach"));
  assert.ok(sync.includes('syncCollection(\n    "recipes"'));
  assert.ok(sync.includes('syncCollection(\n    "mealPlans"'));
  assert.ok(sync.includes('syncCollection(\n    "shoppingList"'));
});
