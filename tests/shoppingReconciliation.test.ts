import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileConfirmedShoppingPurchases } from '../src/utils/purchasePantryMerge';
import type { PantryItem, ShoppingItem } from '../src/types';

const date = '2026-09-13';
const stock = (quantity = 4, unit = 'uds'): PantryItem => ({
  id: 'p-tomato', name: 'Tomate', quantity, unit, category: 'Produce', addedAt: date,
});
const shop = (overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 's-tomato', name: 'Tomate', quantity: 2, unit: 'uds', category: 'Produce',
  checked: false, estimatedPriceEUR: 0, ...overrides,
});

test('confirmed list purchase uses the real shopping quantity/unit and removes only accepted rows', () => {
  const pending = shop({ id: 'pending', name: 'Pepino', quantity: 1 });
  const result = reconcileConfirmedShoppingPurchases(
    [stock()], [shop(), pending], ['s-tomato'], [], date, 'r1'
  );
  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].quantity, 6);
  assert.deepEqual(result.shoppingList.map(item => item.id), ['pending']);
});

test('invalid selected shopping row is not silently removed', () => {
  const invalid = shop({ quantity: 0 });
  const result = reconcileConfirmedShoppingPurchases([], [invalid], ['s-tomato'], [], date, 'r1');
  assert.equal(result.pantry.length, 0);
  assert.equal(result.shoppingList.length, 1);
  assert.equal(result.rejected.length, 1);
});

test('unknown selected shopping id is reported and does not mutate state', () => {
  const list = [shop()];
  const result = reconcileConfirmedShoppingPurchases([], list, ['missing'], [], date, 'r1');
  assert.deepEqual(result.pantry, []);
  assert.deepEqual(result.shoppingList, list);
  assert.deepEqual(result.unresolvedPurchasedItemIds, ['missing']);
});

test('valid reviewed extra is added but AI price and expiry are not persisted', () => {
  const result = reconcileConfirmedShoppingPurchases([], [], [], [{
    name: 'Aguacate', quantity: 2, unit: 'uds', category: 'Produce',
    estimatedCostEUR: 99, expiryDaysLeft: 7,
  }], date, 'review-1');
  assert.equal(result.rejectedExtraItems.length, 0);
  assert.equal(result.pantry.length, 1);
  assert.equal(result.pantry[0].quantity, 2);
  assert.equal(result.pantry[0].unit, 'uds');
  assert.equal(result.pantry[0].estimatedCostEUR, undefined);
  assert.equal(result.pantry[0].expiryDaysLeft, undefined);
  assert.equal(result.pantry[0].purchaseHistory?.[0].source, 'confirmed_reconciliation');
});

test('extra without explicit numeric quantity or unit is rejected without defaults', () => {
  for (const extra of [
    { name: 'Aguacate', unit: 'uds' },
    { name: 'Aguacate', quantity: 2 },
    { name: 'Aguacate', quantity: '2', unit: 'uds' },
    { name: 'Aguacate', quantity: 0, unit: 'uds' },
  ]) {
    const result = reconcileConfirmedShoppingPurchases([], [], [], [extra], date, 'review-2');
    assert.equal(result.pantry.length, 0);
    assert.equal(result.rejectedExtraItems.length, 1);
  }
});

test('compatible list and extra purchases merge in one operation; incompatible units stay separate', () => {
  const combined = reconcileConfirmedShoppingPurchases(
    [stock(1, 'kg')],
    [shop({ quantity: 250, unit: 'g' })],
    ['s-tomato'],
    [{ name: 'Tomate', quantity: 0.25, unit: 'kg', category: 'Produce' }],
    date,
    'review-3'
  );
  assert.equal(combined.pantry.length, 1);
  assert.equal(combined.pantry[0].quantity, 1.5);

  const separate = reconcileConfirmedShoppingPurchases(
    [stock(6, 'uds')], [], [],
    [{ name: 'Tomate', quantity: 200, unit: 'g', category: 'Produce' }],
    date,
    'review-4'
  );
  assert.equal(separate.pantry.length, 2);
  assert.equal(separate.pantry.find(item => item.unit === 'uds')?.quantity, 6);
  assert.equal(separate.pantry.find(item => item.unit === 'g')?.quantity, 200);
});

test('same reconciliation id makes confirmed extras replay-safe while the pantry row survives', () => {
  const extra = [{ name: 'Aguacate', quantity: 2, unit: 'uds', category: 'Produce' }];
  const first = reconcileConfirmedShoppingPurchases([], [], [], extra, date, 'stable-review');
  const second = reconcileConfirmedShoppingPurchases(first.pantry, [], [], extra, date, 'stable-review');
  assert.deepEqual(second.pantry, first.pantry);
  assert.equal(second.acceptedSourceIds.length, 1);
});
