import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECIPES } from "../src/data/initialData";
import {
  isStoredRecipeStructurallyValid,
  parseStoredRecipeCache,
} from "../src/utils/storedRecipeValidation";

const sample = SAMPLE_RECIPES[0];

test("explicit sample recipes satisfy the persisted recipe structure boundary", () => {
  assert.ok(sample);
  assert.equal(isStoredRecipeStructurallyValid(sample), true);
});

test("mixed persisted cache keeps valid recipes and quarantines malformed rows", () => {
  assert.ok(sample);
  const parsed = parseStoredRecipeCache(
    JSON.stringify([
      sample,
      { id: "broken-only-id" },
      null,
      "not-a-recipe",
    ]),
  );

  assert.ok(parsed);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.id, sample.id);
});

test("valid stored provenance remains unchanged after cache parsing", () => {
  assert.ok(sample);
  const stored = {
    ...sample,
    nutritionDataStatus: "verified" as const,
    costDataStatus: "unknown" as const,
  };

  const parsed = parseStoredRecipeCache(JSON.stringify([stored]));

  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.nutritionDataStatus, "verified");
  assert.equal(parsed?.[0]?.costDataStatus, "unknown");
  assert.equal(parsed?.[0]?.healthScore, stored.healthScore);
});

test("persisted recipe requires an explicit nonblank id", () => {
  assert.ok(sample);
  const { id: _id, ...withoutId } = sample;

  assert.equal(isStoredRecipeStructurallyValid(withoutId), false);
  assert.equal(
    isStoredRecipeStructurallyValid({ ...sample, id: "   " }),
    false,
  );
});

test("invalid stored status or optional typed fields are quarantined", () => {
  assert.ok(sample);

  for (const candidate of [
    { ...sample, nutritionDataStatus: "authoritative" },
    { ...sample, costDataStatus: "live_market" },
    { ...sample, healthScore: Number.NaN },
    { ...sample, imageUrl: 123 },
  ]) {
    assert.equal(isStoredRecipeStructurallyValid(candidate), false);
  }
});

test("persisted recipe structure rejects malformed required fields", () => {
  assert.ok(sample);

  for (const candidate of [
    { ...sample, ingredients: undefined },
    { ...sample, ingredients: [] },
    { ...sample, tags: undefined },
    { ...sample, calories: Number.POSITIVE_INFINITY },
    { ...sample, servings: 0 },
    { ...sample, title: { en: sample.title.en } },
  ]) {
    assert.equal(isStoredRecipeStructurallyValid(candidate), false);
  }
});

test("missing or malformed top-level cache remains unresolved", () => {
  assert.equal(parseStoredRecipeCache(null), null);
  assert.equal(parseStoredRecipeCache("{not json"), null);
  assert.equal(parseStoredRecipeCache(JSON.stringify({ id: "recipe" })), null);
});
