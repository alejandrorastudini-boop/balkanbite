import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecipeShoppingNeeds } from '../src/utils/recipeShoppingNeeds';
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
