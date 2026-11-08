import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { MealPlanDay, Recipe } from "../src/types";
import { describeVerifiedChefMealPlan } from "../src/utils/chefWorkspaceFacts";
import { selectCompleteChefServerMealPlan } from "../src/utils/chefServerReadAuthority";

const recipe: Recipe = {
  id: "qa-verified-menu", title: { en: "Rice meal", es: "Arroz", bg: "Ориз" },
  description: { en: "QA", es: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0, difficulty: "easy",
  servings: 1, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  tags: [], ingredients: [{ name: "Rice", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const now = new Date("2026-10-20T12:00:00");
const plan: MealPlanDay[] = [{ date: "2026-10-20", lunch: recipe }];

test("standalone menu answers use only valid meal records and preserve plan-not-consumption language", () => {
  const es = describeVerifiedChefMealPlan("SHOW_TODAYS_MENU", plan, "es", now)!;
  assert.match(es, /hoy \(2026-10-20\)/);
  assert.match(es, /comida: Arroz/);
  assert.match(es, /Es un plan, no consumo confirmado/);
  assert.doesNotMatch(es, /precio|calorías|consumido/);
  assert.match(describeVerifiedChefMealPlan("SHOW_MENU", plan, "en", now)!, /Rice meal/);
  assert.match(describeVerifiedChefMealPlan("SHOW_TODAYS_MENU", plan, "bg", now)!, /Ориз/);
  assert.equal(describeVerifiedChefMealPlan("SHOW_MENU", [plan[0], plan[0]], "en", now), null);
  assert.equal(describeVerifiedChefMealPlan("SHOW_MENU",
    [{ date: "2026-02-30" } as MealPlanDay], "en", now), null);
  assert.equal(describeVerifiedChefMealPlan("SHOW_MENU", plan, "en", new Date("invalid")), null);
  assert.equal(describeVerifiedChefMealPlan("SHOW_SHORTAGES" as never, plan, "en", now), null);
});

test("signed-in meal-plan-only authority rejects wrong account, stale React, absent evidence", () => {
  const evidence = { userId: "qa-owner", serialized: JSON.stringify(plan) };
  assert.deepEqual(selectCompleteChefServerMealPlan("qa-owner", "qa-owner", evidence, plan), plan);
  assert.equal(selectCompleteChefServerMealPlan("other", "other", evidence, plan), null);
  assert.equal(selectCompleteChefServerMealPlan("qa-owner", "other", evidence, plan), null);
  assert.equal(selectCompleteChefServerMealPlan("qa-owner", "qa-owner", undefined, plan), null);
  assert.equal(selectCompleteChefServerMealPlan("qa-owner", "qa-owner", evidence, []), null);
});

test("both Chef surfaces use the independently verified menu rather than composite progression/shopping", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
  const voice = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../src/components/ChefIaModal.tsx", import.meta.url), "utf8");
  assert.match(voice, /workspaceQuery === "SHOW_MENU" \|\| workspaceQuery === "SHOW_TODAYS_MENU"/);
  assert.match(voice, /const rows = onGetAuthoritativeMealPlan\(\)/);
  assert.match(voice, /describeVerifiedChefMealPlan\(workspaceQuery, rows, language\)/);
  assert.match(app, /const getAuthoritativeChefMealPlan = /);
  assert.match(app, /JSON\.stringify\(parsed\) !== JSON\.stringify\(mealPlan\)/);
  assert.match(app, /localStorage\.getItem\("balkanbite_mealplan"\) !== raw/);
  assert.match(hook, /getServerConfirmedChefMealPlan =/);
  assert.match(hook, /chefServerReadEvidence\.current\.mealPlans, mealPlan/);
  assert.match(modal, /onGetAuthoritativeMealPlan=\{onGetAuthoritativeMealPlan\}/);
});
