import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("recipe clear waits for recipe authority", () => {
  const start = app.indexOf("const handleClearRecipes");
  const block = app.slice(start, start + 500);
  assert.match(block, /requireWorkspaceAuthority\(recipesHydrated, "recipes"\)/);
});

test("meal-plan clear waits for meal-plan authority", () => {
  const start = app.indexOf("const handleClearMealPlan");
  const block = app.slice(start, start + 500);
  assert.match(block, /requireWorkspaceAuthority\(mealPlanHydrated, "mealPlan"\)/);
});

test("sample recipe replacement cannot use an unhydrated signed-in baseline", () => {
  const start = app.indexOf("onLoadSampleRecipes={() =>");
  const block = app.slice(start, start + 800);
  const authority = block.indexOf('requireWorkspaceAuthority(recipesHydrated, "recipes")');
  const replace = block.indexOf("submitRecipesReplace");
  assert.ok(authority >= 0 && replace > authority);
});
