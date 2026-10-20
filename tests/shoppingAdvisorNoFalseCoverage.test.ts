import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MealPlanDay, Recipe, ShoppingItem } from "../src/types";
import { SmartShoppingModal } from "../src/components/SmartShoppingModal";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";

const now = new Date("2026-10-21T12:00:00");
const recipe: Recipe = {
  id: "qa-no-false-stock", title: { es: "Arroz", en: "Rice", bg: "Ориз" },
  description: { es: "QA", en: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1, calories: 0,
  proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
  tags: [],
  ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: false }],
  instructions: { es: ["Cocinar"], en: ["Cook"], bg: ["Готви"] },
  nutritionHighlights: { es: "QA", en: "QA", bg: "QA" },
};

test("no planned requirements is unknown coverage, never a stocked pantry or timed trip", () => {
  const guest = evaluateShoppingNeeds([], [], [], "es", now);
  assert.equal(guest.urgencyLevel, "optimal");
  assert.equal(guest.daysUntilNextTripNeeded, null);
  assert.equal(guest.estimatedTotalTripEUR, undefined);
  assert.equal(guest.urgencyLabel.es, "Cobertura desconocida");
  assert.equal(guest.urgencyLabel.en, "Coverage unknown");
  assert.equal(guest.urgencyLabel.bg, "Непотвърдени наличности");
  for (const lang of ["es", "en", "bg"] as const) {
    assert.ok(guest.headline[lang].length > 20);
    assert.ok(guest.reasons[lang][0].length > 20);
  }
  assert.doesNotMatch(guest.headline.en, /pantry covers|well stocked/i);
  assert.doesNotMatch(guest.reasons.en.join(" "), /sufficient quantities in pantry/i);

  const noIngredients: MealPlanDay[] = [{
    date: "2026-10-21", lunch: { ...recipe, ingredients: [] },
  }];
  assert.equal(evaluateShoppingNeeds([], noIngredients, [], "en", now).urgencyLabel.en,
    "Coverage unknown", "a recipe with no ingredients does not establish food availability");
});

test("no calculated need cannot manufacture a future trip date; actual shortages keep urgency", () => {
  const plan: MealPlanDay[] = [{ date: "2026-10-21", lunch: recipe }];
  const withPantry = evaluateShoppingNeeds([{
    id: "qa-stock", name: "QA Rice", quantity: 200, unit: "g",
    category: "Pantry/Grains", addedAt: "2026-10-21",
  }], plan, [], "en", now);
  assert.equal(withPantry.daysUntilNextTripNeeded, null);
  assert.doesNotMatch(withPantry.headline.en, /Pantry Well Stocked|every needed food/);

  const missing = evaluateShoppingNeeds([], plan, [], "en", now);
  assert.equal(missing.urgencyLevel, "urgent");
  assert.equal(missing.daysUntilNextTripNeeded, 0);
  assert.equal(missing.missingMealIngredients.length, 1);
  const pending: ShoppingItem[] = Array.from({ length: 2 }, (_, i) => ({
    id: `qa-item-${i}`, name: `QA Item ${i}`, quantity: 1, unit: "ud",
    category: "Other", checked: false,
  }));
  const recommended = evaluateShoppingNeeds([], [], pending, "en", now);
  assert.equal(recommended.urgencyLevel, "recommended");
  assert.equal(recommended.daysUntilNextTripNeeded, 1);
});

test("advisor modal renders unknown timing neutrally without fabricated four days or green success", () => {
  const diagnostic = evaluateShoppingNeeds([], [], [], "en", now);
  const html = renderToStaticMarkup(React.createElement(SmartShoppingModal, {
    isOpen: true, diagnostic, language: "en", currency: "EUR",
    onClose: () => {}, onGoToShoppingTab: () => {},
    onAddMissingToShoppingList: () => true,
  }));
  assert.match(html, /Coverage unknown/);
  assert.match(html, /No recommended date/);
  assert.doesNotMatch(html, /In 4 days|Pantry Well Stocked|Recommended: Today/);
  assert.doesNotMatch(html, />0%<\/span>/);
});
