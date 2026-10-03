import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const recipes = readFileSync(new URL("../src/components/RecipeView.tsx", import.meta.url), "utf8");
const mealPlan = readFileSync(new URL("../src/components/MealPlanView.tsx", import.meta.url), "utf8");
const firestore = readFileSync(new URL("../src/utils/derivedCollectionFirestore.ts", import.meta.url), "utf8");

test("signed-in explicit recipe replacements use exact command", () => {
  assert.match(hook, /submitRecipesReplace/);
  assert.match(app, /await submitRecipesReplace\(recipes, \[\]\)/);
  assert.match(app, /await submitRecipesReplace\(recipes, enriched\)/);
  assert.match(app, /submitRecipesReplace\(recipes, SAMPLE_RECIPES\)/);
  assert.match(recipes, /await onClearRecipes/);
});

test("signed-in explicit meal-plan replacements use exact command", () => {
  assert.match(hook, /submitMealPlanReplace/);
  assert.match(app, /await submitMealPlanReplace\(mealPlan, \[\]\)/);
  assert.match(app, /await submitMealPlanReplace\(mealPlan, newPlan\)/);
  assert.match(mealPlan, /await onClearMealPlan/);
});

test("derived replacement recognizes exact post-state as idempotent replay", () => {
  assert.match(firestore, /const matchesExpected = observedMatches\(expectedById\)/);
  assert.match(firestore, /const matchesNext = observedMatches\(nextById\)/);
  assert.match(firestore, /!matchesExpected && matchesNext/);
  assert.match(firestore, /outcome: "already-applied"/);
});

test("derived replacement rechecks exact post-state inside transaction", () => {
  assert.match(firestore, /const transactionMatchesNext = allIds\.every/);
  assert.match(firestore, /if \(transactionMatchesNext\)/);
  assert.match(firestore, /return \{ outcome: "already-applied" as const \}/);
});
