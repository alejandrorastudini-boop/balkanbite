import assert from 'node:assert/strict';
import test from 'node:test';
import { deductConfirmedConsumption } from '../src/utils/consumptionDeductions';

const pantry = [
  { id: 'flour', quantity: 2, unit: 'kg' },
  { id: 'eggs', quantity: 6, unit: 'pcs' },
];

test('deducts an exact confirmed consumption without mutating its input', () => {
  const result = deductConfirmedConsumption(pantry, {
    pantryItemId: 'eggs', quantity: 2, unit: 'pcs', confirmed: true,
  });
  assert.deepEqual(result, {
    accepted: true,
    pantry: [
      { id: 'flour', quantity: 2, unit: 'kg' },
      { id: 'eggs', quantity: 4, unit: 'pcs' },
    ],
    deducted: { pantryItemId: 'eggs', quantity: 2, unit: 'pcs' },
  });
  assert.equal(pantry[1].quantity, 6);
});

test('converts compatible units while retaining the stock unit', () => {
  const result = deductConfirmedConsumption(pantry, {
    pantryItemId: 'flour', quantity: 500, unit: 'g', confirmed: true,
  });
  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.pantry[0].quantity, 1.5);
});

test('rejects insufficient stock without creating negative inventory', () => {
  const result = deductConfirmedConsumption(pantry, {
    pantryItemId: 'flour', quantity: 3, unit: 'kg', confirmed: true,
  });
  assert.deepEqual(result, {
    accepted: false,
    pantry,
    reason: 'insufficient-stock',
  });
});

test('rejects dimension-incompatible units without deduction', () => {
  const result = deductConfirmedConsumption(pantry, {
    pantryItemId: 'flour', quantity: 1, unit: 'l', confirmed: true,
  });
  assert.deepEqual(result, {
    accepted: false,
    pantry,
    reason: 'incompatible-unit',
  });
});

test('rejects unknown, nonpositive, and unconfirmed consumption quantities', () => {
  for (const quantity of [undefined, null, 0, -1, Number.NaN]) {
    const result = deductConfirmedConsumption(pantry, {
      pantryItemId: 'flour', quantity, unit: 'kg', confirmed: true,
    });
    assert.equal(result.accepted, false);
    if (!result.accepted) assert.equal(result.reason, 'invalid-consumption');
    assert.deepEqual(result.pantry, pantry);
  }

  const unconfirmed = deductConfirmedConsumption(pantry, {
    pantryItemId: 'flour', quantity: 1, unit: 'kg', confirmed: false,
  });
  assert.equal(unconfirmed.accepted, false);
  if (!unconfirmed.accepted) assert.equal(unconfirmed.reason, 'unconfirmed');
  assert.deepEqual(unconfirmed.pantry, pantry);
});
