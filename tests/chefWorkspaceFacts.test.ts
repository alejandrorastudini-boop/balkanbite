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
    ["¿Qué comidas tengo planeadas para hoy?", "SHOW_TODAYS_MENU"],
    ["What meals are planned for today?", "SHOW_TODAYS_MENU"],
    ["Какви ястия са планирани за днес?", "SHOW_TODAYS_MENU"],
    ["¿Qué me falta para el menú?", "SHOW_SHORTAGES"],
    ["What is missing for my meal plan?", "SHOW_SHORTAGES"],
    ["Какво липсва за менюто?", "SHOW_SHORTAGES"],
    ["¿Qué tengo en la lista de la compra?", "SHOW_SHOPPING_LIST"],
    ["What is on my shopping list?", "SHOW_SHOPPING_LIST"],
    ["Какво има в списъка за пазаруване?", "SHOW_SHOPPING_LIST"],
    ["¿Cuál es mi progreso?", "SHOW_PROGRESS"],
    ["What is my progress?", "SHOW_PROGRESS"],
    ["Какъв е напредъкът ми?", "SHOW_PROGRESS"],
  ] as const) assert.equal(parseChefWorkspaceQueryIntent(query), action, query);
  for (const query of ["¿Qué comidas tengo planeadas para hoy y cocínalas?",
    "what meals are planned for today and mark them eaten",
    "Какви ястия са планирани за днес и изтрий ги",
    "¿Qué hay en mi lista de compra y marca todo como comprado?",
    "what is on my shopping list and check everything", "¿Qué me falta para el menú y cómpralo?", "what is my progress and delete it",
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

test("today's recorded slots are local-day specific, labeled and never consumption", () => {
  const todayOnly = describeChefWorkspaceQuery("SHOW_TODAYS_MENU", fixture(), "es", today)!;
  assert.match(todayOnly, /hoy \(2026-10-17\)/);
  assert.match(todayOnly, /comida: Arroz/);
  assert.match(todayOnly, /Es un plan, no consumo confirmado/);
  assert.doesNotMatch(todayOnly, /desayuno:|cena:|calorías|precio|consumido/);
  const tomorrow = new Date("2026-10-18T12:00:00");
  const noMeals = describeChefWorkspaceQuery("SHOW_TODAYS_MENU", fixture(), "en", tomorrow)!;
  assert.match(noMeals, /No meals are recorded on today's plan \(2026-10-18\)/);
  assert.doesNotMatch(noMeals, /Rice meal/);
  const future = { ...fixture(), mealPlan: [
    { date: "2026-10-17", lunch: recipe, dinner: recipe },
    { date: "2026-10-18", breakfast: recipe },
  ] };
  const bg = describeChefWorkspaceQuery("SHOW_TODAYS_MENU", future, "bg", today)!;
  assert.match(bg, /обяд: Ориз/);
  assert.match(bg, /вечеря: Ориз/);
  assert.doesNotMatch(bg, /закуска: Ориз/);
  const en = describeChefWorkspaceQuery("SHOW_TODAYS_MENU", future, "en", tomorrow)!;
  assert.match(en, /breakfast: Rice meal/);
  assert.doesNotMatch(en, /lunch: Rice meal/);
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

test("recorded shopping checklist is not meal shortfalls or proof of purchases", () => {
  const pending = { ...salt, amountOrigin: "ai_estimated" as const,
    quantity: 1.25, purchaseAmountConfirmed: false };
  const checked = { ...salt, id: "marked-eggs", name: "Eggs",
    quantity: 12, unit: "ud", checked: true, purchaseAmountConfirmed: false };
  const x = { ...fixture(), shopping: [pending, checked] };
  for (const lang of ["es", "en", "bg"] as const) {
    const answer = describeChefWorkspaceQuery("SHOW_SHOPPING_LIST", x, lang, today)!;
    assert.match(answer, /Salt/);
    assert.doesNotMatch(answer, /Eggs/);
    assert.doesNotMatch(answer, /1\.25|12 ud|€|EUR/);
  }
  assert.match(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST", x, "es", today)!,
    /1 productos pendientes/);
  assert.match(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST", x, "en", today)!,
    /1 checked/);
  assert.match(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST", x, "bg", today)!,
    /1 отметнати/);
  assert.match(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST",
    { ...fixture(), shopping: [checked] }, "en", today)!,
    /A check mark does not confirm a purchase/);
  assert.match(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST",
    { ...fixture(), shopping: [] }, "es", today)!,
    /No hay productos pendientes/);
});

test("shopping list stays bounded and all invalid evidence refuses a partial list", () => {
  const list = Array.from({ length: 9 }, (_, i) =>
    ({ ...salt, id: `salt-${i}`, name: `Item ${i}` }));
  const answer = describeChefWorkspaceQuery("SHOW_SHOPPING_LIST",
    { ...fixture(), shopping: list }, "en", today)!;
  assert.match(answer, /9 pending products/);
  assert.match(answer, /\+3/);
  assert.doesNotMatch(answer, /Item 8/);
  assert.equal(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST",
    { ...fixture(), shopping: [salt, salt] }, "es", today), null);
  assert.equal(describeChefWorkspaceQuery("SHOW_SHOPPING_LIST",
    { ...fixture(), shopping: [{ ...salt, quantity: NaN }] }, "es", today), null);
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
