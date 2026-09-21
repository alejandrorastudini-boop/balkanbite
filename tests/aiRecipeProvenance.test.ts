import assert from "node:assert/strict";
import test from "node:test";
import { applyAiRecipeEstimateProvenance } from "../src/utils/aiRecipeProvenance";

test("AI recipe provenance always downgrades model nutrition and cost to estimated", () => {
  const result = applyAiRecipeEstimateProvenance({
    id: "recipe-1",
    title: { en: "Soup" },
    calories: 420,
    costPerServingEUR: 2.4,
    nutritionDataStatus: "verified",
    costDataStatus: "verified",
    healthScore: 99,
  });

  assert.ok(result);
  assert.equal(result?.nutritionDataStatus, "estimated");
  assert.equal(result?.costDataStatus, "estimated");
  assert.equal("healthScore" in result!, false);
  assert.equal(result?.calories, 420);
  assert.equal(result?.costPerServingEUR, 2.4);
  assert.deepEqual(result?.title, { en: "Soup" });
});

test("AI recipe provenance also overrides unknown or arbitrary status values", () => {
  const result = applyAiRecipeEstimateProvenance({
    nutritionDataStatus: "authoritative",
    costDataStatus: "live_market",
    healthScore: "excellent",
    ingredients: [{ name: "Beans" }],
  });

  assert.ok(result);
  assert.equal(result?.nutritionDataStatus, "estimated");
  assert.equal(result?.costDataStatus, "estimated");
  assert.equal("healthScore" in result!, false);
  assert.deepEqual(result?.ingredients, [{ name: "Beans" }]);
});

test("non-object AI recipe payloads are rejected instead of gaining provenance", () => {
  for (const value of [null, undefined, "recipe", 1, [], true]) {
    assert.equal(applyAiRecipeEstimateProvenance(value), null);
  }
});
