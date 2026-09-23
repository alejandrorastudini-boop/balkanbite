import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/components/RecipeView.tsx", import.meta.url),
  "utf8",
);

test("recipe card and cooking drawer stage intent instead of deducting directly", () => {
  assert.match(source, /const requestCookConfirmation = \(recipe: Recipe\) => \{\s*if \(pendingCookRecipe\) return;\s*cookConfirmationConsumed\.current = false;\s*setCookFeedback\(null\);\s*setPendingCookRecipe\(recipe\);\s*\}/);
  assert.match(source, /id=\{\x60cook-btn-\$\{recipe\.id\}\x60\}[\s\S]{0,120}onClick=\{\(\) => requestCookConfirmation\(recipe\)\}/);
  assert.match(source, /requestCookConfirmation\(selectedRecipe\)/);
  assert.doesNotMatch(source, /onClick=\{\(\) => handleCook\(/);
});

test("only explicit cook confirmation dispatches the inventory operation", () => {
  assert.match(source, /const confirmPendingCook = \(\) => \{\s*if \(!pendingCookRecipe \|\| cookConfirmationConsumed\.current\) return;\s*cookConfirmationConsumed\.current = true;\s*const outcome = handleCook\(pendingCookRecipe\)/);
  assert.match(source, /isOpen=\{pendingCookRecipe !== null\}/);
  assert.match(source, /onClose=\{\(\) => setPendingCookRecipe\(null\)\}/);
  assert.match(source, /onConfirm=\{confirmPendingCook\}/);
  assert.equal((source.match(/onCookRecipe\(recipe\)/g) ?? []).length, 1);
});

test("failed cook keeps the recipe open and displays the actual failure", () => {
  assert.match(source, /if \(outcome\.success\) setSelectedRecipe\(null\)/);
  assert.match(source, /cookFeedback\?\.kind === "error"[\s\S]*?<p role="alert"[\s\S]*?\{cookFeedback\.text\}/);
  assert.doesNotMatch(source, /handleCook\(selectedRecipe\);\s*setSelectedRecipe\(null\)/);
});
