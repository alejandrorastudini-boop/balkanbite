import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const initialDataSource = readFileSync(
  new URL("../src/data/initialData.ts", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

test("production initial data has no fabricated pantry dataset", () => {
  assert.doesNotMatch(initialDataSource, /SAMPLE_PANTRY/);
  assert.doesNotMatch(initialDataSource, /INITIAL_PANTRY/);
  assert.doesNotMatch(initialDataSource, /id:\s*"sp-\d+"/);
});

test("App does not import an implicit initial or sample pantry", () => {
  const importBlock = appSource.slice(0, appSource.indexOf("function App"));
  assert.doesNotMatch(importBlock, /SAMPLE_PANTRY|INITIAL_PANTRY/);
});

test("explicit recipe demo data remains separate from pantry defaults", () => {
  assert.match(initialDataSource, /export const SAMPLE_RECIPES:/);
  assert.match(initialDataSource, /export const INITIAL_RECIPES: Recipe\[\] = \[\];/);
});
