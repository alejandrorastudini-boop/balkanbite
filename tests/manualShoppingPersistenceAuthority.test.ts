import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const shoppingSource = readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8",
);

test("manual shopping creation propagates authoritative persistence outcome", () => {
  const start = appSource.indexOf("const handleAddShoppingItem = async");
  const end = appSource.indexOf("const handleClearShoppingList", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes("): Promise<boolean> =>"));
  assert.ok(block.includes("const result = await submitShoppingItemCreate(newItem)"));
  assert.ok(block.includes('result.outcome === "needs-review"'));
  assert.ok(block.includes("return false"));
  assert.ok(block.includes("return true"));
  assert.equal(block.includes("void submitShoppingItemCreate"), false);
});

test("manual shopping modal waits for save and preserves draft on failure", () => {
  assert.ok(
    shoppingSource.includes(
      'onAddItem: (item: Omit<ShoppingItem, "id" | "checked">) => boolean | Promise<boolean>;',
    ),
  );

  const start = shoppingSource.indexOf("const handleCreate = async");
  const end = shoppingSource.indexOf("const formatListAsText", start);
  assert.ok(start >= 0 && end > start);
  const block = shoppingSource.slice(start, end);

  const awaitIndex = block.indexOf("await Promise.resolve(onAddItem(");
  const failureIndex = block.indexOf("if (!saved)");
  const clearIndex = block.indexOf('setNewItemName("")');
  assert.ok(awaitIndex >= 0 && failureIndex > awaitIndex && clearIndex > failureIndex);
  assert.equal(block.slice(0, failureIndex).includes('setNewItemName("")'), false);
  assert.ok(block.includes("setManualItemSaveError("));
  assert.ok(shoppingSource.includes("disabled={isSavingManualItem}"));
  assert.ok(shoppingSource.includes("isSavingManualItem ||"));
  assert.ok(shoppingSource.includes('role="alert"'));
});
