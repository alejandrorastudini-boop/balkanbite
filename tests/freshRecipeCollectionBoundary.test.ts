import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  INITIAL_RECIPES,
  SAMPLE_RECIPES,
} from "../src/data/initialData";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

test("fresh recipe collection is empty while explicit demo recipes remain available", () => {
  assert.deepEqual(INITIAL_RECIPES, []);
  assert.ok(SAMPLE_RECIPES.length > 0);
  assert.notEqual(INITIAL_RECIPES, SAMPLE_RECIPES);
});

test("guest recipe startup sanitizes persisted rows and falls back to empty initial state", () => {
  const start = appSource.indexOf("const [recipes, setRecipes]");
  const end = appSource.indexOf("const [shoppingList", start);
  assert.ok(start >= 0 && end > start);

  const initializer = appSource.slice(start, end);
  assert.match(initializer, /parseStoredRecipeCache/);
  assert.match(initializer, /\?\?\s*INITIAL_RECIPES/);
  assert.doesNotMatch(initializer, /JSON\.parse/);
  assert.doesNotMatch(initializer, /SAMPLE_RECIPES/);
});

test("guest workspace rehydration uses the recipe-domain cache parser", () => {
  assert.match(
    appSource,
    /const guestRecipes\s*=\s*parseStoredRecipeCache\(localStorage\.getItem\("balkanbite_recipes"\)\)/,
  );
  assert.doesNotMatch(appSource, /parseArrayCache<Recipe>/);
});

test("sample recipes remain available only through an explicit sample-load action", () => {
  assert.match(
    appSource,
    /onLoadSampleRecipes=\{\(\) => setRecipes\(SAMPLE_RECIPES\)\}/,
  );
});
