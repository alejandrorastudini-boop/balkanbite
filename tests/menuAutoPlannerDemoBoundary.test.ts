import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import type { MealPlanDay, PantryItem, Recipe } from "../src/types";
import {
  adaptMealPlanToPantry,
  syncRecipesWithPantry,
} from "../src/utils/menuAutoPlanner";

const pantry: PantryItem[] = [
  {
    id: "pantry-tomato",
    name: "Tomato",
    quantity: 150,
    unit: "g",
    category: "Produce",
    expiryDaysLeft: 3,
    addedAt: "2026-09-21",
  },
];

const plannedRecipe: Recipe = {
  id: "explicit-plan-recipe",
  title: { en: "Tomato plate", bg: "Домати", es: "Tomate" },
  description: { en: "", bg: "", es: "" },
  prepTimeMin: 0,
  cookTimeMin: 0,
  costPerServingEUR: 0,
  difficulty: "easy",
  servings: 1,
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  nutritionDataStatus: "unknown",
  costDataStatus: "unknown",
  tags: [],
  ingredients: [
    { name: "Tomato", amount: 100, unit: "g", inPantry: false },
  ],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

test("empty recipe collection never falls back to demo recipes", () => {
  assert.deepEqual(syncRecipesWithPantry([], pantry), []);
});

test("empty recipe collection and empty plan remain empty", () => {
  const result = adaptMealPlanToPantry(pantry, [], []);
  assert.deepEqual(result.newPlan, []);
  assert.equal(result.readyToCookMealsCount, 0);
  assert.equal(result.perishableSavedCount, 0);
});

test("an explicit existing plan is preserved and only pantry availability is synchronized", () => {
  const existingPlan: MealPlanDay[] = [
    { date: "2026-09-21", breakfast: plannedRecipe },
  ];

  const result = adaptMealPlanToPantry(pantry, [], existingPlan);

  assert.equal(result.newPlan.length, 1);
  assert.equal(result.newPlan[0]?.date, "2026-09-21");
  assert.equal(result.newPlan[0]?.breakfast?.id, plannedRecipe.id);
  assert.equal(result.newPlan[0]?.breakfast?.ingredients[0]?.inPantry, true);
  assert.equal(result.readyToCookMealsCount, 1);
  assert.equal(result.perishableSavedCount, 1);
});

test("planner source cannot import implicit initial or sample recipe fallbacks", () => {
  const source = fs.readFileSync(
    new URL("../src/utils/menuAutoPlanner.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /SAMPLE_RECIPES/);
  assert.doesNotMatch(source, /INITIAL_RECIPES/);
});
