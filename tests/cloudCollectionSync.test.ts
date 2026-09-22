import assert from "node:assert/strict";
import test from "node:test";
import {
  findRemovedDocumentIds,
  getScopedDocumentId,
  getSyncedItemKey,
  selectCanonicalRemoteEntries,
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

  assert.equal(getSyncedItemKey("inventory", { id: "legacy/a" }), "legacy/a");
});

test("scoped document ids isolate identical logical ids across users", () => {
  assert.equal(
    getScopedDocumentId("user-a", "2026-09-20"),
    "u_user-a__2026-09-20",
  );
  assert.equal(
    getScopedDocumentId("user-b", "2026-09-20"),
    "u_user-b__2026-09-20",
  );
  assert.notEqual(
    getScopedDocumentId("user-a", "shared-id"),
    getScopedDocumentId("user-b", "shared-id"),
  );
  assert.equal(
    getScopedDocumentId("user/a", "item/a"),
    "u_user%2Fa__item%2Fa",
  );
});


test("scoped canonical remote rows win over legacy duplicates without tracking malformed rows", () => {
  const scopedId = getScopedDocumentId("user-a", "2026-09-20");
  const selected = selectCanonicalRemoteEntries(
    "mealPlans",
    [
      {
        documentId: "2026-09-20",
        item: { date: "2026-09-20", lunch: { id: "legacy" } },
      },
      {
        documentId: scopedId,
        item: { date: "2026-09-20", lunch: { id: "canonical" } },
      },
      {
        documentId: "broken",
        item: { lunch: { id: "missing-date" } },
      },
    ],
    (logicalKey) => getScopedDocumentId("user-a", logicalKey),
  );

  assert.deepEqual(selected.entries, [
    {
      documentId: scopedId,
      item: { date: "2026-09-20", lunch: { id: "canonical" } },
    },
  ]);
  assert.deepEqual(selected.trackedDocumentIds, [
    "2026-09-20",
    scopedId,
  ]);
});
