import assert from "node:assert/strict";
import test from "node:test";
import type { MealLog, MealPlanDay, Recipe } from "../src/types";
import { derivePlannedMealConsumption } from "../src/utils/plannedMealConsumption";

const recipe = { id: "r1" } as Recipe;
const day: MealPlanDay = { date: "2026-10-06", lunch: recipe };
const log = (overrides: Partial<MealLog> = {}): MealLog => ({
  id: "m1",
  date: "2026-10-06",
  mealType: "lunch",
  timestamp: "2026-10-06T12:00:00+03:00",
  ...overrides,
});

test("exact recipe evidence confirms the planned recipe was logged", () => {
  assert.equal(derivePlannedMealConsumption(day, [log({ recipeId: "r1" })], "lunch").status, "planned_recipe_logged");
});

test("same slot with different recipe does not become plan adherence", () => {
  assert.equal(derivePlannedMealConsumption(day, [log({ recipeId: "other" })], "lunch").status, "planned_slot_logged_other");
});

test("manual same-slot log proves a meal log, not the planned recipe", () => {
  assert.equal(derivePlannedMealConsumption(day, [log({ manualName: "Soup" })], "lunch").status, "planned_slot_logged_other");
});

test("different date or meal slot does not confirm consumption", () => {
  assert.equal(derivePlannedMealConsumption(day, [log({ date: "2026-10-07", recipeId: "r1" })], "lunch").status, "planned_unconfirmed");
  assert.equal(derivePlannedMealConsumption(day, [log({ mealType: "dinner", recipeId: "r1" })], "lunch").status, "planned_unconfirmed");
});

test("empty planned slot stays not planned", () => {
  assert.equal(derivePlannedMealConsumption(day, [], "breakfast").status, "not_planned");
});
