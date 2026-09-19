import assert from "node:assert/strict";
import test from "node:test";
import {
  findRemovedDocumentIds,
  getSyncedItemKey,
} from "../src/utils/cloudCollectionSync";

test("uses the real stable identity for every synced collection", () => {
  assert.equal(getSyncedItemKey("inventory", { id: "pantry-1" }), "pantry-1");
  assert.equal(getSyncedItemKey("recipes", { id: "recipe-1" }), "recipe-1");
  assert.equal(getSyncedItemKey("shoppingList", { id: "shop-1" }), "shop-1");
  assert.equal(
    getSyncedItemKey("mealPlans", { date: "2026-09-20" }),
    "2026-09-20",
  );
});

test("meal-plan rows never fall back to an undefined document id", () => {
  assert.equal(getSyncedItemKey("mealPlans", { id: "wrong-shape" }), undefined);
  assert.equal(getSyncedItemKey("mealPlans", { date: "" }), undefined);
  assert.equal(getSyncedItemKey("mealPlans", {}), undefined);
});

test("removed cloud documents are derived deterministically", () => {
  assert.deepEqual(
    findRemovedDocumentIds(["a", "b", "b", "c"], ["b", "d"]),
    ["a", "c"],
  );
});

test("unknown or unsafe direct document identities remain unresolved", () => {
  assert.equal(getSyncedItemKey("other", { id: "x" }), undefined);
  assert.equal(getSyncedItemKey("recipes", { id: "   " }), undefined);
  assert.equal(getSyncedItemKey("recipes", { id: "folder/recipe" }), undefined);
  assert.equal(getSyncedItemKey("shoppingList", { id: "a/b" }), undefined);
  assert.equal(getSyncedItemKey("mealPlans", { date: "2026/09/20" }), undefined);

  // Inventory IDs are encoded into a scoped document ID by the hook.
  assert.equal(getSyncedItemKey("inventory", { id: "legacy/a" }), "legacy/a");
});
