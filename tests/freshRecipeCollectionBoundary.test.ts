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

test("guest recipe startup falls back to empty initial state, not sample recipes", () => {
  const start = appSource.indexOf("const [recipes, setRecipes]");
  const end = appSource.indexOf("const [shoppingList", start);
  assert.ok(start >= 0 && end > start);

  const initializer = appSource.slice(start, end);
  assert.match(initializer, /saved \? JSON\.parse\(saved\) : INITIAL_RECIPES/);
  assert.match(initializer, /return INITIAL_RECIPES\.map/);
  assert.doesNotMatch(initializer, /SAMPLE_RECIPES/);
});

test("sample recipes remain available only through an explicit sample-load action", () => {
  assert.match(
    appSource,
    /onLoadSampleRecipes=\{\(\) => setRecipes\(SAMPLE_RECIPES\)\}/,
  );
});
