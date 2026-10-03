import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const modal = readFileSync(
  new URL("../src/components/SmartShoppingModal.tsx", import.meta.url),
  "utf8",
);
const banner = readFileSync(
  new URL("../src/components/SmartShoppingBanner.tsx", import.meta.url),
  "utf8",
);

test("smart shopping bulk add returns authoritative persistence outcome", () => {
  const start = app.indexOf("const handleAddMultipleShoppingItems = async");
  const end = app.indexOf("const handleAdaptMenuToPantry", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);

  assert.ok(block.includes("): Promise<boolean> =>"));
  assert.ok(block.includes("await submitShoppingItemsCreate(newItems)"));
  assert.ok(block.includes('result.outcome === "needs-review"'));
  assert.equal(block.includes("void submitShoppingItemsCreate"), false);
  assert.ok(block.includes("return false"));
  assert.ok(block.includes("return true"));
});

for (const [name, source, handler] of [
  ["modal", modal, "const handleAddMissing = async"],
  ["banner", banner, "const handleQuickAdd = async"],
] as const) {
  test(`smart shopping ${name} shows success only after awaited save`, () => {
    assert.ok(source.includes(
      'onAddMissingToShoppingList: (items: Array<Omit<ShoppingItem, "id" | "checked">>) => boolean | Promise<boolean>;',
    ));
    const start = source.indexOf(handler);
    assert.ok(start >= 0);
    const block = source.slice(start, start + 1600);
    const awaitIndex = block.indexOf("await Promise.resolve(");
    const successIndex = block.indexOf("setAddedSuccess(true)");
    assert.ok(awaitIndex >= 0 && successIndex > awaitIndex);
    assert.ok(block.includes("if (!saved)"));
    assert.ok(source.includes('role="alert"'));
    assert.ok(source.includes("addedSuccess || isAdding"));
  });
}
