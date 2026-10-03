import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/MealPlanView.tsx", import.meta.url),
  "utf8",
);

test("meal-plan shortage add waits for shopping persistence outcome", () => {
  assert.ok(source.includes(
    'onAddItemsToShoppingList?: (items: Array<Omit<ShoppingItem, "id" | "checked">>) => boolean | Promise<boolean>;',
  ));
  const start = source.indexOf("const handleAddMissingToShopping = async");
  const end = source.indexOf("const selectedDateStr", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);

  assert.ok(block.includes("await Promise.resolve("));
  assert.ok(block.includes("if (!saved) setMissingShoppingAddError(true)"));
  assert.ok(source.includes("disabled={isAddingMissingToShopping}"));
  assert.ok(source.includes('role="alert"'));
  assert.equal(
    source.includes(
      "onClick={() => onAddItemsToShoppingList(shoppingDiagnostic.itemsToAddToShoppingList)}",
    ),
    false,
  );
});
