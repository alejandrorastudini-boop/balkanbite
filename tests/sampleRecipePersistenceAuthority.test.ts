import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");
const view = fs.readFileSync("src/components/RecipeView.tsx", "utf8");

test("sample recipe load returns authoritative signed-in persistence result", () => {
  const start = app.indexOf("onLoadSampleRecipes={async");
  const end = app.indexOf("isLoadingAi={isLoadingAi}", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.match(block, /if \(!currentUser\)[\s\S]*setRecipes\(SAMPLE_RECIPES\)[\s\S]*return true/);
  assert.match(block, /await submitRecipesReplace\(recipes, SAMPLE_RECIPES\)/);
  assert.match(block, /outcome === "needs-review"[\s\S]*return false/);
  assert.doesNotMatch(block, /void submitRecipesReplace/);
});

test("sample recipe buttons await one command and expose retryable failure", () => {
  assert.match(view, /onLoadSampleRecipes\?: \(\) => boolean \| Promise<boolean>/);
  assert.match(view, /if \(!onLoadSampleRecipes \|\| isLoadingSampleRecipes\) return/);
  assert.match(view, /const saved = await Promise\.resolve\(onLoadSampleRecipes\(\)\)/);
  assert.match(view, /disabled=\{isLoadingSampleRecipes\}/);
  assert.match(view, /role="alert"/);
});
