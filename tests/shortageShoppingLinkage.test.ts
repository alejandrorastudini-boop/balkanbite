import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileShortageShoppingLines,
  type ConfirmedShortage,
  type ShoppingLine,
} from '../src/utils/shortageShoppingLinkage';

const flourShortage: ConfirmedShortage = {
  id: 'weekly-plan:flour',
  name: 'Flour',
  quantity: 500,
  unit: 'g',
};

test('adds each confirmed shortage once with stable provenance and unknown price', () => {
  const lines = reconcileShortageShoppingLines([], [flourShortage, flourShortage]);

  assert.deepEqual(lines, [
    {
      id: 'shortage:weekly-plan:flour',
      name: 'Flour',
      quantity: 500,
      unit: 'g',
      source: 'plan-shortage',
      shortageId: 'weekly-plan:flour',
      estimatedPriceEUR: undefined,
    },
  ]);
});

test('reconciles a source-derived line when its shortage changes', () => {
  const existing: ShoppingLine[] = [
    {
      id: 'shortage:weekly-plan:flour',
      name: 'Flour',
      quantity: 200,
      unit: 'g',
      source: 'plan-shortage',
      shortageId: 'weekly-plan:flour',
      estimatedPriceEUR: undefined,
    },
  ];

  assert.deepEqual(reconcileShortageShoppingLines(existing, [flourShortage]), [
    {
      id: 'shortage:weekly-plan:flour',
      name: 'Flour',
      quantity: 500,
      unit: 'g',
      source: 'plan-shortage',
      shortageId: 'weekly-plan:flour',
      estimatedPriceEUR: undefined,
    },
  ]);
});

test('preserves manual lines and excludes unresolved shortage fields', () => {
  const manual: ShoppingLine = {
    id: 'manual:coffee',
    name: 'Coffee',
    quantity: 1,
    unit: 'bag',
    source: 'manual',
    estimatedPriceEUR: 7.5,
  };
  const unresolved = { id: 'weekly-plan:milk', name: 'Milk', quantity: 0, unit: 'ml' };

  assert.deepEqual(reconcileShortageShoppingLines([manual], [unresolved]), [manual]);
});
