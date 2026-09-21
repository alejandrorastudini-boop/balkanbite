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
const firebaseSyncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);
const legacyIdSource = readFileSync(
  new URL("../src/utils/legacyDemoPantryIds.ts", import.meta.url),
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

test("authenticated inventory keeps the legacy demo-id denylist without sample pantry facts", () => {
  assert.doesNotMatch(firebaseSyncSource, /SAMPLE_PANTRY|INITIAL_PANTRY/);
  assert.match(firebaseSyncSource, /isLegacyDemoPantryItemId\(item\.id\)/);
  assert.match(legacyIdSource, /"sp-1"/);
  assert.match(legacyIdSource, /"sp-14"/);
  assert.doesNotMatch(
    legacyIdSource,
    /Huevos|Philadelphia|Arroz|Lentejas|estimatedCostEUR|expiryDaysLeft/,
  );
});
