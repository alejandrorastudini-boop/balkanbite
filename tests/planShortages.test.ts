import assert from 'node:assert/strict';
import test from 'node:test';
import { computePlanShortages } from '../src/utils/planShortages';

test('derives shortages only from known requirements and compatible pantry stock', () => {
  const result = computePlanShortages(
    [
      { ingredientId: 'beans-lunch', foodName: 'Beans', quantity: 500, unit: 'g' },
      { ingredientId: 'beans-dinner', foodName: ' beans ', quantity: 300, unit: 'g' },
      { ingredientId: 'flour', foodName: 'Flour', quantity: 1, unit: 'kg' },
    ],
    [
      { id: 'beans-stock', foodName: 'BEANS', quantity: 600, unit: 'g' },
      { id: 'flour-stock', foodName: 'flour', quantity: 250, unit: 'g' },
    ],
  );

  assert.deepEqual(result, {
    shortages: [
      { ingredientId: 'beans-dinner', foodName: 'beans', quantity: 200, unit: 'g' },
      { ingredientId: 'flour', foodName: 'Flour', quantity: 0.75, unit: 'kg' },
    ],
    pending: [],
  });
});

test('keeps unknown requirements and unknown matching pantry stock pending', () => {
  const result = computePlanShortages(
    [
      { ingredientId: 'unknown-quantity', foodName: 'Rice', quantity: undefined, unit: 'g' },
      { ingredientId: 'unknown-unit', foodName: 'Lentils', quantity: 200, unit: undefined },
      { ingredientId: 'unknown-stock', foodName: 'Oats', quantity: 100, unit: 'g' },
    ],
    [{ id: 'oats-stock', foodName: 'Oats', quantity: undefined, unit: 'g' }],
  );

  assert.deepEqual(result, {
    shortages: [],
    pending: [
      { ingredientId: 'unknown-quantity', reason: 'invalid-quantity' },
      { ingredientId: 'unknown-unit', reason: 'invalid-unit' },
      { ingredientId: 'unknown-stock', reason: 'invalid-pantry-stock' },
    ],
  });
});

test('does not convert incompatible stock into a shortage quantity', () => {
  const result = computePlanShortages(
    [{ ingredientId: 'oil', foodName: 'Oil', quantity: 1, unit: 'l' }],
    [{ id: 'oil-by-weight', foodName: 'Oil', quantity: 500, unit: 'g' }],
  );

  assert.deepEqual(result, {
    shortages: [],
    pending: [{ ingredientId: 'oil', reason: 'incompatible-pantry-stock' }],
  });
});
