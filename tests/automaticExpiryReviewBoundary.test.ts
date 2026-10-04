import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe } from "../src/types";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";

const recipe: Recipe = {
  id: "expiry-boundary",
  title: { en: "Tomato", bg: "Домат", es: "Tomate" },
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
  ingredients: [{ name: "Tomato", amount: 100, unit: "g", inPantry: false }],
  instructions: { en: [], bg: [], es: [] },
  nutritionHighlights: { en: "", bg: "", es: "" },
};

const stock = (overrides: Partial<PantryItem> = {}): PantryItem => ({
  id: "tomato",
  name: "Tomato",
  quantity: 150,
  unit: "g",
  category: "Produce",
  addedAt: "2026-10-01",
  ...overrides,
});

const inPantry = (item: PantryItem, now: Date): boolean =>
  syncRecipesWithPantry([recipe], [item], now)[0].ingredients[0].inPantry;

test("passed entered expiry cannot satisfy automatic recipe availability", () => {
  assert.equal(
    inPantry(stock({ expiryDaysLeft: 1 }), new Date("2026-10-04T12:00:00Z")),
    false,
  );
});

test("partial merged expiry stays uncertain without becoming a hard availability block", () => {
  assert.equal(
    inPantry(
      stock({ expiryDaysLeft: 5, expiryIsPartial: true }),
      new Date("2026-10-02T12:00:00Z"),
    ),
    true,
  );
});

test("missing expiry evidence remains usable without a fabricated freshness claim", () => {
  assert.equal(
    inPantry(stock(), new Date("2026-10-20T12:00:00Z")),
    true,
  );
});
