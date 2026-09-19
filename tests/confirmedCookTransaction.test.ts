import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmCookTransaction, type ConfirmedCookState } from '../src/utils/confirmedCookTransaction';

const initialState: ConfirmedCookState = {
  pantry: [
    { id: 'potatoes', quantity: 1, unit: 'kg' },
    { id: 'eggs', quantity: 6, unit: 'pcs' },
  ],
  consumptionRecords: [],
};

test('records one confirmed meal and deducts each matched pantry item once', () => {
  const result = confirmCookTransaction(initialState, {
    cookConfirmationId: 'cook-1',
    mealId: 'musaka',
    confirmed: true,
    ingredients: [
      { ingredientId: 'potato-ingredient', pantryItemId: 'potatoes', quantity: 500, unit: 'g' },
      { ingredientId: 'egg-ingredient', pantryItemId: 'eggs', quantity: 2, unit: 'pcs' },
    ],
  });

  assert.equal(result.outcome, 'recorded');
  if (result.outcome !== 'recorded') return;
  assert.deepEqual(result.state.pantry, [
    { id: 'potatoes', quantity: 0.5, unit: 'kg' },
    { id: 'eggs', quantity: 4, unit: 'pcs' },
  ]);
  assert.deepEqual(result.record, {
    cookConfirmationId: 'cook-1',
    mealId: 'musaka',
    deductions: [
      { ingredientId: 'potato-ingredient', pantryItemId: 'potatoes', quantity: 500, unit: 'g' },
      { ingredientId: 'egg-ingredient', pantryItemId: 'eggs', quantity: 2, unit: 'pcs' },
    ],
  });
  assert.deepEqual(initialState, {
    pantry: [
      { id: 'potatoes', quantity: 1, unit: 'kg' },
      { id: 'eggs', quantity: 6, unit: 'pcs' },
    ],
    consumptionRecords: [],
  });
});

test('leaves every pantry item and record unchanged when one ingredient needs review', () => {
  const result = confirmCookTransaction(initialState, {
    cookConfirmationId: 'cook-2',
    mealId: 'musaka',
    confirmed: true,
    ingredients: [
      { ingredientId: 'potato-ingredient', pantryItemId: 'potatoes', quantity: 500, unit: 'g' },
      { ingredientId: 'oil-ingredient', pantryItemId: 'oil', quantity: 100, unit: 'ml' },
    ],
  });

  assert.deepEqual(result, {
    outcome: 'needs-review',
    state: initialState,
    pendingIngredients: [{ ingredientId: 'oil-ingredient', reason: 'stock-not-found' }],
  });
});

test('does not deduct again when the same cook confirmation is retried', () => {
  const first = confirmCookTransaction(initialState, {
    cookConfirmationId: 'cook-3',
    mealId: 'shopska-salad',
    confirmed: true,
    ingredients: [
      { ingredientId: 'egg-ingredient', pantryItemId: 'eggs', quantity: 1, unit: 'pcs' },
    ],
  });
  assert.equal(first.outcome, 'recorded');
  if (first.outcome !== 'recorded') return;

  const retry = confirmCookTransaction(first.state, {
    cookConfirmationId: 'cook-3',
    mealId: 'shopska-salad',
    confirmed: true,
    ingredients: [
      { ingredientId: 'egg-ingredient', pantryItemId: 'eggs', quantity: 1, unit: 'pcs' },
    ],
  });

  assert.equal(retry.outcome, 'already-recorded');
  assert.deepEqual(retry.state, first.state);
  if (retry.outcome === 'already-recorded') assert.deepEqual(retry.record, first.record);
});
