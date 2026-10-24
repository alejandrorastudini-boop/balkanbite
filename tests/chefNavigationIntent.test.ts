import assert from "node:assert/strict";
import test from "node:test";
import { chefNavigationFeedback, parseChefNavigationIntent } from "../src/utils/chefNavigationIntent";

test("Chef IA explicit read-only navigation in Spanish, English and Bulgarian", () => {
  const examples: Record<string, string> = {
    "Muéstrame lo que tengo": "pantry",
    "Abre mi despensa": "pantry",
    "Enséñame las recetas": "recipes",
    "Abre la lista de la compra": "shopping",
    "Quiero ver el menú semanal": "mealPlan",
    "Abre mi perfil": "profile",
    "go to the home screen": "home",
    "Show me my pantry": "pantry",
    "open grocery list": "shopping",
    "view weekly menu": "mealPlan",
    "покажи ми килера": "pantry",
    "отвори списъка за пазаруване": "shopping",
    "покажи ми седмичното меню": "mealPlan",
    "отвори рецептите": "recipes",
  };
  for (const [phrase, tab] of Object.entries(examples)) {
    assert.deepEqual(parseChefNavigationIntent(phrase),
      { actionId: "NAVIGATE_TAB", tab }, phrase);
  }
});

test("mutating, compound and ambiguous utterances never become silent navigation", () => {
  const unsafe = [
    "añade 2 kg de arroz a la despensa",
    "abre la despensa y borra todo",
    "abre la lista de la compra y compra leche",
    "cambia el menú semanal",
    "reduce el presupuesto",
    "qué va a caducar",
    "quiero ver las recetas con pollo",
    "what do I have and add milk",
    "show me how to delete pantry stock",
    "open my profile and update my health records",
    "отвори списъка за пазаруване и добави мляко",
    "",
    "  ",
    42,
    null,
  ];
  for (const phrase of unsafe)
    assert.equal(parseChefNavigationIntent(phrase), null, String(phrase));
  assert.equal(parseChefNavigationIntent("abre " + "despensa ".repeat(100)), null);
});

test("navigation feedback is a view transition, never a persistence claim", () => {
  assert.equal(chefNavigationFeedback("pantry", "es"), "Abriendo la despensa.");
  assert.equal(chefNavigationFeedback("shopping", "bg"), "Отварям списъка за пазаруване.");
  assert.equal(chefNavigationFeedback("recipes", "en"), "Opening recipes.");
});
