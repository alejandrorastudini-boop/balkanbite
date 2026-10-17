import assert from "node:assert/strict";
import test from "node:test";
import type { Recipe, PantryItem, ShoppingItem, MealPlanDay } from "../src/types";
import { describeChefWorkspaceQuery, parseChefWorkspaceQueryIntent, type ChefWorkspaceSnapshot } from "../src/utils/chefWorkspaceFacts";

const recipe: Recipe = {
  id: "qa-menu-rice", title: { en: "Rice meal", es: "Arroz", bg: "Ориз" },
  description: { en: "QA", es: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0, difficulty: "easy",
  servings: 1, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  tags: [], ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const rice: PantryItem = { id: "qa-rice", name: "QA Rice", quantity: 50, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-17" };
const salt: ShoppingItem = { id: "manual-salt", name: "Salt", quantity: 1, unit: "kg",
  checked: false, category: "Other", amountOrigin: "user_entered",
  purchaseAmountConfirmed: false };
const today = new Date("2026-10-17T12:00:00");
const plan: MealPlanDay[] = [{ date: "2026-10-17", lunch: recipe }];
const fixture = (): ChefWorkspaceSnapshot => ({
  pantry: [rice], mealPlan: plan, shopping: [salt],
  progression: [
    { version: 1, eventId: "purchase:qa1", type: "confirmed_purchase_applied",
      occurredAt: "2026-10-16T10:00:00Z", evidence: "deterministic_state_transition", evidenceCount: 1 },
    { version: 1, eventId: "cook:qa1", type: "recipe_cook_inventory_applied",
      occurredAt: "2026-10-17T10:00:00Z", evidence: "deterministic_state_transition", evidenceCount: 1 },
  ],
});

test("ES EN BG exact read-only queries and no compound actions", () => {
  for (const [query, action] of [
    ["¿Qué tengo en el menú semanal?", "SHOW_MENU"],
    ["What meals are planned?", "SHOW_MENU"],
    ["Какво има в седмичното меню?", "SHOW_MENU"],
    ["¿Qué me falta para el menú?", "SHOW_SHORTAGES"],
    ["What is missing for my meal plan?", "SHOW_SHORTAGES"],
    ["Какво липсва за менюто?", "SHOW_SHORTAGES"],
    ["¿Cuál es mi progreso?", "SHOW_PROGRESS"],
    ["What is my progress?", "SHOW_PROGRESS"],
    ["Какъв е напредъкът ми?", "SHOW_PROGRESS"],
  ] as const) assert.equal(parseChefWorkspaceQueryIntent(query), action, query);
  for (const query of ["¿Qué me falta para el menú y cómpralo?", "what is my progress and delete it",
    "change tomorrow's menu", "", 1, null, {}, "¿Cuánto he gastado?"]) {
    assert.equal(parseChefWorkspaceQueryIntent(query), null, String(query));
  }
});

test("plan shows stored meals by local 7-day window, never as consumed or nutrition claims", () => {
  const answer = describeChefWorkspaceQuery("SHOW_MENU", fixture(), "es", today)!;
  assert.match(answer, /2026-10-17: Arroz/);
  assert.match(answer, /planes, no consumos confirmados/);
  assert.doesNotMatch(answer, /calorías|precio/);
  const other = { ...fixture(), mealPlan: [{ date: "2026-10-08", lunch: recipe }] };
  assert.match(describeChefWorkspaceQuery("SHOW_MENU", other, "en", today)!, /No meals are recorded/);
});

test("verified shortfall is deterministic, per unit, with no invented prices or purchases", () => {
  const answer = describeChefWorkspaceQuery("SHOW_SHORTAGES", fixture(), "en", today)!;
  assert.match(answer, /Calculated shortages/);
  assert.match(answer, /QA Rice \(50 g, 2026-10-17\)/);
  assert.match(answer, /not purchased items or verified prices/);
  assert.doesNotMatch(answer, /Salt \(/);
});

test("unverified units are counted for review and not invented as quantitative shortages", () => {
  const withUnknown = { ...recipe, ingredients: [{ name: "QA Rice", amount: 1, unit: "mystery", inPantry: false }] };
  const x = { ...fixture(), mealPlan: [{ date: "2026-10-17", lunch: withUnknown }] };
  const answer = describeChefWorkspaceQuery("SHOW_SHORTAGES", x, "es", today)!;
  assert.match(answer, /No hay faltantes cuantitativos verificados/);
  assert.match(answer, /1 requisitos sin verificar/);
});

test("progress counts only complete journaled transitions, not budget/health scores", () => {
  const answer = describeChefWorkspaceQuery("SHOW_PROGRESS", fixture(), "bg", today)!;
  assert.match(answer, /2 потвърдени събития/);
  assert.match(answer, /1 приложени покупки/);
  assert.match(answer, /1 готвения/);
  assert.match(answer, /не е хранителна оценка/);
  assert.match(describeChefWorkspaceQuery("SHOW_PROGRESS",
    { ...fixture(), progression: [] }, "en", today)!, /0 verified events/);
});

test("duplicate, malformed, partially filtered or invalid chronology blocks read-only answers", () => {
  const base = fixture();
  const bad: ChefWorkspaceSnapshot[] = [
    { ...base, mealPlan: [...plan, ...plan] },
    { ...base, shopping: [salt, salt] },
    { ...base, progression: [...base.progression, base.progression[0]] },
    { ...base, pantry: [rice, { ...rice, quantity: NaN }] },
    { ...base, progression: [{ ...base.progression[0], evidenceCount: 0 }] },
    { ...base, mealPlan: [{ date: "2026-02-31", lunch: recipe }] },
  ];
  for (const x of bad) assert.equal(describeChefWorkspaceQuery("SHOW_PROGRESS", x, "en", today), null);
  assert.equal(describeChefWorkspaceQuery("SHOW_MENU", base, "en", new Date("invalid")), null);
});
