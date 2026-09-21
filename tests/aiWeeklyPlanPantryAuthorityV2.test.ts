import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { MealPlanDay, PantryItem, Recipe } from "../src/types";
import { syncMealPlanWithPantry } from "../src/utils/menuAutoPlanner";

const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

const recipeFixture = (inPantry: boolean): Recipe => ({
  id: "recipe-rice",
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

const planFixture = (inPantry: boolean): MealPlanDay[] => [
  {
    date: "2026-09-21",
    breakfast: recipeFixture(inPantry),
    lunch: recipeFixture(inPantry),
    dinner: recipeFixture(inPantry),
  },
];

const pantryFixture = (quantity: number): PantryItem[] => [
  {
    id: "rice-1",
    name: "Rice",
    quantity,
    unit: "g",
    category: "Pantry/Grains",
    addedAt: "2026-09-21",
  },
];

test("weekly-plan prompt context contains no derived inPantry authority", () => {
  const start = serverSource.indexOf(
    'app.post("/api/ai/generate-weekly-plan"',
  );
  const end = serverSource.indexOf(
    'app.post("/api/ai/suggest-shopping"',
    start,
  );
  const block = serverSource.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(block, /const recipePromptContext = Array\.isArray\(recipes\)/);
  assert.match(block, /name: ingredientRecord\.name/);
  assert.match(block, /amount: ingredientRecord\.amount/);
  assert.match(block, /unit: ingredientRecord\.unit/);
  assert.match(
    block,
    /Available Recipes Pool: \$\{JSON\.stringify\(recipePromptContext\)\}/,
  );
  assert.doesNotMatch(block, /ingredientRecord\.inPantry/);
  assert.doesNotMatch(
    block,
    /ingredients:\s*r\.ingredients/,
  );
});

test("serverless entry graph does not import the client meal planner", () => {
  const serverImports = serverSource.slice(
    0,
    serverSource.indexOf("dotenv.config()"),
  );

  assert.doesNotMatch(
    serverImports,
    /menuAutoPlanner/,
  );
  assert.doesNotMatch(
    serverImports,
    /syncMealPlanWithPantry|syncRecipesWithPantry/,
  );
});

test("meal-plan resync overrides stale false when pantry quantity is sufficient", () => {
  const result = syncMealPlanWithPantry(
    planFixture(false),
    pantryFixture(150),
  );

  assert.equal(result.newPlan[0].breakfast?.ingredients[0].inPantry, true);
  assert.equal(result.newPlan[0].lunch?.ingredients[0].inPantry, true);
  assert.equal(result.newPlan[0].dinner?.ingredients[0].inPantry, true);
  assert.equal(result.readyToCookMealsCount, 3);
});

test("meal-plan resync overrides stale true when pantry quantity is insufficient", () => {
  const result = syncMealPlanWithPantry(
    planFixture(true),
    pantryFixture(50),
  );

  assert.equal(result.newPlan[0].breakfast?.ingredients[0].inPantry, false);
  assert.equal(result.newPlan[0].lunch?.ingredients[0].inPantry, false);
  assert.equal(result.newPlan[0].dinner?.ingredients[0].inPantry, false);
  assert.equal(result.readyToCookMealsCount, 0);
});

test("App resyncs AI weekly plan against pantry before state persistence", () => {
  const start = appSource.indexOf("const handleGenerateAiWeekPlan");
  const end = appSource.indexOf("const handleResetApp", start);
  const block = appSource.slice(start, end);

  const syncIndex = block.indexOf(
    "syncMealPlanWithPantry(data.mealPlan, pantry)",
  );
  const persistIndex = block.indexOf("setMealPlan(newPlan)");

  assert.ok(syncIndex >= 0);
  assert.ok(persistIndex > syncIndex);
  assert.doesNotMatch(block, /setMealPlan\(data\.mealPlan\)/);
});

test("empty existing plan remains empty during deterministic resync", () => {
  const result = syncMealPlanWithPantry([], pantryFixture(150));
  assert.deepEqual(result, {
    newPlan: [],
    readyToCookMealsCount: 0,
    perishableSavedCount: 0,
  });
});
