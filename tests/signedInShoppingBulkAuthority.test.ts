import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const shopping = readFileSync(new URL("../src/components/ShoppingView.tsx", import.meta.url), "utf8");

test("signed-in shopping batch paths use explicit commands", () => {
  assert.match(app, /submitShoppingItemsCreate\(newItems\)/);
  assert.match(app, /submitShoppingItemsCreate\(newShoppingItems\)/);
  assert.match(app, /submitShoppingItemsCreate\(result\.items\)/);
});

test("signed-in shopping clear uses exact baseline command", () => {
  assert.match(app, /await submitShoppingItemsClear\(shoppingList\)/);
  assert.match(app, /onClearList=\{handleClearShoppingList\}/);
  assert.match(shopping, /await onClearList/);
});
