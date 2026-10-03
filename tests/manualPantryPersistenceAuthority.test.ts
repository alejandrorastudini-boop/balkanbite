import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const pantry = readFileSync(new URL("../src/components/PantryView.tsx", import.meta.url), "utf8");

test("manual pantry creation propagates authoritative persistence outcome", () => {
  const start = app.indexOf("const handleAddPantryItem = async");
  const end = app.indexOf("const handleAddMultiplePantryItems", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.ok(block.includes("Promise<boolean>"));
  assert.ok(block.includes("return dispatchSignedInPantryCreations([newItem])"));
  assert.ok(block.includes("return true"));
  assert.equal(block.includes("void dispatchSignedInPantryCreations"), false);
});

test("manual pantry form preserves draft until save is confirmed", () => {
  assert.ok(pantry.includes(
    'onAddItem: (item: Omit<PantryItem, "id" | "addedAt">) => boolean | Promise<boolean>;',
  ));
  const start = pantry.indexOf("const handleCreateItem = async");
  const end = pantry.indexOf("return (", start);
  assert.ok(start >= 0 && end > start);
  const block = pantry.slice(start, end);
  const awaitIndex = block.indexOf("await Promise.resolve(onAddItem(");
  const failureIndex = block.indexOf("if (!saved)");
  const clearIndex = block.indexOf('setName("")');
  assert.ok(awaitIndex >= 0 && failureIndex > awaitIndex && clearIndex > failureIndex);
  assert.equal(block.slice(0, failureIndex).includes('setName("")'), false);
  assert.ok(pantry.includes("disabled={isSavingItem}"));
  assert.ok(block.includes("setFormError("));
});
