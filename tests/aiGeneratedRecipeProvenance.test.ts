import assert from "node:assert/strict";
import test from "node:test";
import { markAiGeneratedRecipePlanningEstimates } from "../src/utils/aiGeneratedRecipeProvenance";

test("AI recipe provenance always downgrades model claims to planning estimates", () => {
  const input = {
    id: "model-recipe",
    title: { en: "Soup", bg: "Супа", es: "Sopa" },
    calories: 420,
    costPerServingEUR: 3.5,
    healthScore: 99,
    nutritionDataStatus: "verified",
    costDataStatus: "verified",
  };

  const result = markAiGeneratedRecipePlanningEstimates(input);

  assert.equal(result.id, "model-recipe");
  assert.equal(result.calories, 420);
  assert.equal(result.costPerServingEUR, 3.5);
  assert.equal(result.healthScore, undefined);
  assert.equal(result.nutritionDataStatus, "estimated");
  assert.equal(result.costDataStatus, "estimated");
});

test("AI recipe provenance leaves unrelated recipe content unchanged", () => {
  const ingredients = [{ name: "Tomato", amount: 2, unit: "pcs" }];
  const input = {
    ingredients,
    tags: ["quick"],
    imageUrl: "/example.jpg",
  };

  const result = markAiGeneratedRecipePlanningEstimates(input);

  assert.equal(result.ingredients, ingredients);
  assert.deepEqual(result.tags, ["quick"]);
  assert.equal(result.imageUrl, "/example.jpg");
});
