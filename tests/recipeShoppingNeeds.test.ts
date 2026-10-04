import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRecipeShoppingNeed, buildRecipeShoppingNeeds } from '../src/utils/recipeShoppingNeeds';
import { INITIAL_RECIPES } from '../src/data/initialData';
import type { PantryItem, ShoppingItem } from '../src/types';
const stock = (quantity: number, unit: string): PantryItem => ({ id: `${quantity}-${unit}`, name: 'Lentejas', quantity, unit, category: 'Pantry/Grains', addedAt: '2026-09-13' });
const recipe = (amount: number, unit: string) => ({ ...INITIAL_RECIPES[0], ingredients: [{ name: 'Lentejas', amount, unit, inPantry: false }] });
const pending = (quantity: number, unit = 'g'): ShoppingItem => ({ id: 's1', name: 'Lentejas', quantity, unit, checked: false, category: 'Other' });
test('buys only the deficit and leaves an unknown price absent', () => {
 const result = buildRecipeShoppingNeeds(recipe(500, 'g'), [stock(320, 'g')]);
 assert.equal(result.items.length, 1); assert.equal(result.items[0].quantity, 180); assert.equal(result.items[0].estimatedPriceEUR, undefined);
});
test('sums compatible kg/g stocks', () => assert.equal(buildRecipeShoppingNeeds(recipe(500, 'g'), [stock(.2, 'kg'), stock(300, 'g')]).items.length, 0));
test('does not turn a package into grams', () => {
 const result = buildRecipeShoppingNeeds(recipe(200, 'g'), [stock(1, 'paquete')]);
 assert.equal(result.items.length, 0); assert.equal(result.unverified.length, 1);
});
test('counts only compatible pending quantities and is idempotent', () => {
 assert.equal(buildRecipeShoppingNeeds(recipe(500, 'g'), [stock(320, 'g')], [pending(180)]).items.length, 0);
 assert.equal(buildRecipeShoppingNeeds(recipe(500, 'g'), [stock(320, 'g')], [pending(80)]).items[0].quantity, 100);
 assert.equal(buildRecipeShoppingNeeds(recipe(500, 'g'), [stock(320, 'g')], [pending(1, 'paquete')]).items[0].quantity, 180);
});
test('unknown category and invalid quantities stay conservative', () => {
 assert.equal(buildRecipeShoppingNeeds(recipe(500, 'g'), []).items[0].category, 'Other');
 for (const amount of [NaN, Infinity, -1, 0]) assert.equal(buildRecipeShoppingNeeds(recipe(amount, 'g'), []).items.length, 0);
});


test("expiry-review stock makes recipe shopping need unverified instead of covered or auto-purchased", () => {
  const ingredient = { name: "Tomato", amount: 100, unit: "g", inPantry: false };
  const reviewPantry = [{
    id: "tomato-old",
    name: "Tomato",
    quantity: 200,
    unit: "g",
    category: "Produce" as const,
    addedAt: "2026-10-01",
    expiryDaysLeft: 1,
  }];

  const assessment = assessRecipeShoppingNeed(
    ingredient,
    reviewPantry,
    [],
    new Date("2026-10-04T12:00:00.000Z"),
  );
  assert.equal(assessment.status, "unverified");

  const needs = buildRecipeShoppingNeeds(
    { ...INITIAL_RECIPES[0], ingredients: [ingredient] },
    reviewPantry,
    [],
    new Date("2026-10-04T12:00:00.000Z"),
  );
  assert.deepEqual(needs.items, []);
  assert.equal(needs.unverified.length, 1);
});

test("review stock does not fabricate a shortfall when usable stock alone is insufficient", () => {
  const ingredient = { name: "Tomato", amount: 100, unit: "g", inPantry: false };
  const mixedPantry = [
    {
      id: "tomato-ok",
      name: "Tomato",
      quantity: 50,
      unit: "g",
      category: "Produce" as const,
      addedAt: "2026-10-04",
    },
    {
      id: "tomato-review",
      name: "Tomato",
      quantity: 100,
      unit: "g",
      category: "Produce" as const,
      addedAt: "2026-10-01",
      expiryDaysLeft: 1,
    },
  ];

  const assessment = assessRecipeShoppingNeed(
    ingredient,
    mixedPantry,
    [],
    new Date("2026-10-04T12:00:00.000Z"),
  );
  assert.equal(assessment.status, "unverified");
});

test("missing expiry evidence remains eligible for deterministic shopping coverage", () => {
  const ingredient = { name: "Tomato", amount: 100, unit: "g", inPantry: false };
  const unknownExpiryPantry = [{
    id: "tomato-unknown",
    name: "Tomato",
    quantity: 100,
    unit: "g",
    category: "Produce" as const,
    addedAt: "2026-09-01",
  }];

  const assessment = assessRecipeShoppingNeed(
    ingredient,
    unknownExpiryPantry,
    [],
    new Date("2026-10-04T12:00:00.000Z"),
  );
  assert.equal(assessment.status, "covered");
});


test("qualified pending product names do not hide a different recipe shortfall", () => {
  const result = buildRecipeShoppingNeeds(
    recipe(500, "g"),
    [stock(320, "g")],
    [pending(180, "g"), { ...pending(180, "g"), id: "s2", name: "Lentejas rojas" }],
  );
  assert.equal(result.items.length, 0);

  const onlyQualified = buildRecipeShoppingNeeds(
    recipe(500, "g"),
    [stock(320, "g")],
    [{ ...pending(180, "g"), name: "Lentejas rojas" }],
  );
  assert.equal(onlyQualified.items[0]?.quantity, 180);
});

test("pending shopping identity normalizes Unicode form, case and whitespace only", () => {
  const normalizedPending = {
    ...pending(180, "g"),
    name: "  LENTEJAS   ",
  };
  assert.equal(
    buildRecipeShoppingNeeds(
      recipe(500, "g"),
      [stock(320, "g")],
      [normalizedPending],
    ).items.length,
    0,
  );
});
