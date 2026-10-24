import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PantryItem, MealPlanDay, Recipe, ShoppingItem } from "../src/types";
import {
  describeChefWorkspaceQuery, describeVerifiedChefShortages,
} from "../src/utils/chefWorkspaceFacts";

const recipe: Recipe = {
  id: "qa-shortage-rice",
  title: { en: "Rice meal", es: "Arroz", bg: "Ориз" },
  description: { en: "QA", es: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1, calories: 0, proteinG: 0,
  carbsG: 0, fatG: 0, fiberG: 0, tags: [],
  ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const now = new Date("2026-10-21T12:00:00");
const pantry: PantryItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 50, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-21",
}];
const mealPlan: MealPlanDay[] = [{ date: "2026-10-21", lunch: recipe }];
const shopping: ShoppingItem[] = [{
  id: "qa-shopping-rice", name: "QA Rice", quantity: 500,
  unit: "g", category: "Other", checked: false,
  amountOrigin: "user_entered", purchaseAmountConfirmed: false,
}];

test("shortage answers are identical with or without unrelated shopping/progression history", () => {
  for (const action of ["SHOW_SHORTAGES", "SHOW_TODAYS_SHORTAGES"] as const) {
    for (const lang of ["es", "en", "bg"] as const) {
      const standalone = describeVerifiedChefShortages(action,
        { pantry, mealPlan }, lang, now)!;
      const composite = describeChefWorkspaceQuery(action,
        { pantry, mealPlan, shopping, progression: [] }, lang, now)!;
      assert.equal(standalone, composite);
      assert.match(standalone, /QA Rice \(50 g, 2026-10-21\)/);
      assert.doesNotMatch(standalone, /500 g|precio confirmado|€|EUR|purchased QA Rice/);
    }
  }
});

test("invalid, duplicate, unrepresentable or incompatible pantry/menu input fails or stays uncertain", () => {
  const sources = { pantry, mealPlan };
  assert.equal(describeVerifiedChefShortages("SHOW_MENU" as never, sources, "en", now), null);
  assert.equal(describeVerifiedChefShortages("SHOW_SHORTAGES", sources, "en", new Date("invalid")), null);
  assert.equal(describeVerifiedChefShortages("SHOW_SHORTAGES",
    { pantry: [...pantry, pantry[0]], mealPlan }, "en", now), null);
  assert.equal(describeVerifiedChefShortages("SHOW_SHORTAGES",
    { pantry, mealPlan: [...mealPlan, mealPlan[0]] }, "en", now), null);
  assert.equal(describeVerifiedChefShortages("SHOW_SHORTAGES",
    { pantry: [{ ...pantry[0], quantity: NaN }], mealPlan }, "en", now), null);
  assert.equal(describeVerifiedChefShortages("SHOW_SHORTAGES",
    { pantry, mealPlan: [{ date: "2026-02-30", lunch: recipe }] }, "en", now), null);
  const unknownRecipe: Recipe = { ...recipe, ingredients: [
    { name: "QA Rice", amount: 1, unit: "unknown", inPantry: false },
  ] };
  const uncertain = describeVerifiedChefShortages("SHOW_TODAYS_SHORTAGES", {
    pantry, mealPlan: [{ date: "2026-10-21", lunch: unknownRecipe }],
  }, "en", now)!;
  assert.match(uncertain, /1 requirements need review/);
  assert.doesNotMatch(uncertain, /QA Rice \(/);
  const missingPlan = describeVerifiedChefShortages("SHOW_TODAYS_SHORTAGES", {
    pantry, mealPlan: [],
  }, "es", now)!;
  assert.match(missingPlan, /No hay comidas registradas para hoy/);
  assert.doesNotMatch(missingPlan, /no faltan alimentos|todo disponible/);
});

test("both Chef surfaces obtain independently verified pantry and meal plan before calculating shortages", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const chef = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../src/components/ChefIaModal.tsx", import.meta.url), "utf8");
  assert.match(app, /const getAuthoritativeChefShortages = /);
  assert.match(app, /const pantryRows = getAuthoritativePantryForChef\(\)/);
  assert.match(app, /const planRows = getAuthoritativeChefMealPlan\(\)/);
  assert.match(app, /localStorage\.getItem\(GUEST_PANTRY_KEY\) !== pantryRaw/);
  assert.match(app, /localStorage\.getItem\("balkanbite_mealplan"\) !== planRaw/);
  assert.match(app, /hasPendingGuestMutationJournal\(localStorage\)/);
  assert.match(chef, /workspaceQuery === "SHOW_SHORTAGES" \|\| workspaceQuery === "SHOW_TODAYS_SHORTAGES"/);
  assert.match(chef, /const sources = onGetAuthoritativeShortages\(\)/);
  assert.match(chef, /describeVerifiedChefShortages\(workspaceQuery, sources, language\)/);
  assert.match(modal, /onGetAuthoritativeShortages=\{onGetAuthoritativeShortages\}/);
});
