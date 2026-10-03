import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sync = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("generic signed-in shopping writer is retired", () => {
  const helper = sync.slice(sync.indexOf("// Sync Collection Helper"), sync.indexOf("// A capture returns"));
  const guard = helper.indexOf('collectionName === "shoppingList" ||');
  const batch = helper.indexOf("const batch = writeBatch(db)");
  assert.ok(guard > 0 && batch > guard);
});

test("signed-in toggle does not optimistically mutate shopping state", () => {
  const block = app.slice(
    app.indexOf("const handleToggleShoppingItem"),
    app.indexOf("const handleDeleteShoppingItem"),
  );
  assert.match(block, /if \(!currentUser\)[\s\S]*setShoppingList/);
  assert.match(block, /submitShoppingItemReplace\(expected, next\)/);
});

test("signed-in delete does not optimistically mutate shopping state", () => {
  const block = app.slice(
    app.indexOf("const handleDeleteShoppingItem"),
    app.indexOf("const handleAddShoppingItem"),
  );
  assert.match(block, /if \(!currentUser\)[\s\S]*setShoppingList/);
  assert.match(block, /submitShoppingItemRemove\(expected\)/);
});

test("manual signed-in add persists explicitly and guest remains local", () => {
  const block = app.slice(
    app.indexOf("const handleAddShoppingItem"),
    app.indexOf("const handleTransferToPantry"),
  );
  assert.match(block, /if \(!currentUser\)[\s\S]*setShoppingList/);
  assert.match(block, /submitShoppingItemCreate\(newItem\)/);
});
