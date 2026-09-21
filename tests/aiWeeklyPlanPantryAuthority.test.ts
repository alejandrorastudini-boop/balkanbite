import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Recipe } from "../src/types";
import {
  buildWeeklyPlanAvailabilityPantry,
  buildWeeklyPlanRecipePromptContext,
} from "../src/utils/aiWeeklyPlanPantryAuthority";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";

const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

const recipeFixture = (inPantry: boolean): Recipe => ({
  id: "recipe-1",
  title: { en: "Rice bowl", bg: "Ориз", es: "Arroz" },
  description: { en: "Test", bg: "Тест", es: "Prueba" },
  prepTimeMin: 5,
  cookTimeMin: 10,
  costPerServingEUR: 1,
  difficulty: "easy",
  servings: 1,
  calories: 300,
  proteinG: 10,
  carbsG: 50,
  fatG: 5,
  fiberG: 3,
  nutritionDataStatus: "estimated",
  costDataStatus: "estimated",
  tags: ["quick"],
  ingredients: [
    {
      name: "Rice",
      amount: 100,
      unit: "g",
      inPantry,
    },
  ],
  instructions: {
    en: ["Cook"],
    bg: ["Сготви"],
    es: ["Cocina"],
  },
  nutritionHighlights: {
    en: "Estimated",
    bg: "Оценка",
    es: "Estimado",
  },
});

test("weekly-plan AI recipe context excludes derived inPantry flags", () => {
  const context = buildWeeklyPlanRecipePromptContext([
    recipeFixture(true),
    recipeFixture(false),
  ]);

  assert.equal(context.length, 2);
  for (const recipe of context) {
    assert.equal(recipe.ingredients.length, 1);
    assert.deepEqual(recipe.ingredients[0], {
      name: "Rice",
      amount: 100,
      unit: "g",
    });
    assert.equal("inPantry" in recipe.ingredients[0], false);
  }
});

test("malformed prompt-context rows cannot become pantry availability evidence", () => {
  const pantry = buildWeeklyPlanAvailabilityPantry([
    { name: "Rice", quantity: 200, unit: "g", nameBg: "Ориз" },
    { name: "Missing amount", unit: "g" },
    { name: "Zero", quantity: 0, unit: "g" },
    { name: "", quantity: 1, unit: "kg" },
    null,
  ]);

  assert.deepEqual(pantry, [
    {
      name: "Rice",
      quantity: 200,
      unit: "g",
      nameBg: "Ориз",
    },
  ]);
});

test("deterministic pantry sync overrides stale false with true when stock covers requirement", () => {
  const pantry = buildWeeklyPlanAvailabilityPantry([
    { name: "Rice", quantity: 150, unit: "g" },
  ]);
  const [synced] = syncRecipesWithPantry(
    [recipeFixture(false)],
    pantry as any,
  );

  assert.equal(synced.ingredients[0].inPantry, true);
});

test("deterministic pantry sync overrides stale true with false when stock is insufficient", () => {
  const pantry = buildWeeklyPlanAvailabilityPantry([
    { name: "Rice", quantity: 50, unit: "g" },
  ]);
  const [synced] = syncRecipesWithPantry(
    [recipeFixture(true)],
    pantry as any,
  );

  assert.equal(synced.ingredients[0].inPantry, false);
});

test("weekly-plan endpoint uses stripped recipe context and deterministic output resync", () => {
  const start = serverSource.indexOf(
    'app.post("/api/ai/generate-weekly-plan"',
  );
  const end = serverSource.indexOf(
    'app.post("/api/ai/suggest-shopping"',
    start,
  );
  const block = serverSource.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(
    block,
    /const recipePromptContext = buildWeeklyPlanRecipePromptContext\(recipes\);/,
  );
  assert.match(
    block,
    /const availabilityPantry = buildWeeklyPlanAvailabilityPantry\(pantry\);/,
  );
  assert.match(
    block,
    /Available Recipes Pool: \$\{JSON\.stringify\(recipePromptContext\)\}/,
  );
  assert.doesNotMatch(
    block,
    /recipes\.map\(\(r: any\).*ingredients: r\.ingredients/,
  );

  const validateIndex = block.indexOf("validateAiRecipeStructure");
  const syncIndex = block.indexOf("syncRecipesWithPantry", validateIndex);
  const returnIndex = block.indexOf("authoritativeRecipe", syncIndex);

  assert.ok(validateIndex >= 0);
  assert.ok(syncIndex > validateIndex);
  assert.ok(returnIndex > syncIndex);
});
