import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../src/components/RecipeView.tsx", import.meta.url), "utf8");

test("recipe shopping success waits for signed-in persistence", () => {
  const start = app.indexOf("const handleAddMissingToShopping = async");
  const end = app.indexOf("const handleGenerateAiRecipes", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  const awaitIndex = block.indexOf("await submitShoppingItemsCreate(newShoppingItems)");
  const successIndex = block.indexOf("verified quantitative shortfall(s) to your shopping list!");
  assert.ok(awaitIndex >= 0 && successIndex > awaitIndex);
  assert.equal(block.includes("void submitShoppingItemsCreate"), false);
  assert.ok(block.includes('result.outcome === "needs-review"'));
  assert.ok(block.includes("return false"));
});

test("recipe shopping UI blocks duplicate submits while persistence is pending", () => {
  assert.ok(view.includes("shoppingAddRecipeId"));
  assert.ok(view.includes("if (shoppingAddRecipeId !== null) return"));
  assert.ok(view.includes("await Promise.resolve(onAddMissingToShopping(recipe))"));
  assert.ok(view.includes("disabled={shoppingAddRecipeId !== null}"));
  assert.equal(view.includes("onClick={() => onAddMissingToShopping(recipe)}"), false);
  assert.equal(view.includes("onClick={() => onAddMissingToShopping(selectedRecipe)}"), false);
});
