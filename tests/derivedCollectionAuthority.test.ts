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

test("derived equality canonicalizes object key order before comparison", () => {
  assert.match(firestore, /Object\.entries\(value as Record<string, unknown>\)/);
  assert.match(firestore, /\.sort\(\(\[left\], \[right\]\) => left\.localeCompare\(right\)\)/);
  assert.match(firestore, /JSON\.stringify\(canonicalize\(value\)\)/);
});

test("derived whole-collection replacements use a shared owner revision fence", () => {
  assert.match(firestore, /"derivedCollectionAuthorities"/);
  assert.match(firestore, /const authority = await tx\.get\(authorityRef\)/);
  assert.match(firestore, /authorityData\.revision !== expectedAuthorityRevision/);
  assert.match(firestore, /revision: expectedAuthorityRevision === null \? 0 : expectedAuthorityRevision \+ 1/);
});

test("a concurrent authority revision change fails closed before derived writes", () => {
  const authorityRead = firestore.indexOf("const authority = await tx.get(authorityRef)");
  const itemWrites = firestore.indexOf("tx.set(ref, { ...next, userId", authorityRead);
  assert.ok(authorityRead >= 0 && itemWrites > authorityRead);
  const fenced = firestore.slice(authorityRead, itemWrites);
  assert.match(fenced, /reason: "stale-state"/);
});
