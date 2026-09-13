import assert from 'node:assert/strict';
import test from 'node:test';
import { isIngredientQuantityAvailable } from '../src/utils/menuAutoPlanner';
import type { PantryItem, RecipeIngredient } from '../src/types';

const tomatoIngredient: RecipeIngredient = {
  name: 'Tomate',
  amount: 2,
  unit: 'uds',
  inPantry: true,
};

const pantry = (quantity: number): PantryItem[] => [{
  id: 'tomato',
  name: 'Tomate',
  quantity,
  unit: 'uds',
  category: 'Produce',
  addedAt: '2026-09-13',
}];

test('live pantry quantity overrides a stale persisted inPantry=true flag', () => {
  assert.equal(tomatoIngredient.inPantry, true);
  assert.equal(
    isIngredientQuantityAvailable(
      tomatoIngredient.name,
      tomatoIngredient.amount,
      tomatoIngredient.unit,
      pantry(1)
    ),
    false
  );
});

test('live pantry availability turns true again when compatible stock is sufficient', () => {
  assert.equal(
    isIngredientQuantityAvailable(
      tomatoIngredient.name,
      tomatoIngredient.amount,
      tomatoIngredient.unit,
      pantry(2)
    ),
    true
  );
});
