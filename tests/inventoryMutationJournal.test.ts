import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyInventoryMutation,
  type InventoryMutationRecord,
  type InventoryMutationState,
} from '../src/utils/inventoryMutationJournal';

interface TestItem {
  id: string;
  quantity: number;
  unit: string;
  name: string;
  expiryDate?: string;
}

const initialState = (): InventoryMutationState<TestItem> => ({
  inventory: [{ id: 'beans', name: 'Beans', quantity: 2, unit: 'kg' }],
  journal: [],
});

const mutation = (overrides: Partial<InventoryMutationRecord> = {}): InventoryMutationRecord => ({
  id: 'mutation-1',
  inventoryItemId: 'beans',
  source: { type: 'manual-adjustment', id: 'adjustment-1' },
  quantityDelta: 1,
  unit: 'kg',
  occurredAt: '2026-09-19T12:00:00.000Z',
  ...overrides,
});

test('records source, signed quantity and unit for an accepted adjustment', () => {
  const result = applyInventoryMutation(initialState(), { mutation: mutation() });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.inventory[0], { id: 'beans', name: 'Beans', quantity: 3, unit: 'kg' });
  assert.deepEqual(result.state.journal, [mutation()]);
});

test('preserves unknown item fields when applying a consumption mutation', () => {
  const state: InventoryMutationState<TestItem> = {
    inventory: [{ id: 'beans', name: 'Beans', quantity: 2, unit: 'kg', expiryDate: undefined }],
    journal: [],
  };
  const consumption = mutation({
    id: 'mutation-2',
    source: { type: 'consumption', id: 'meal-1' },
    quantityDelta: -0.5,
  });
  const result = applyInventoryMutation(state, { mutation: consumption });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.inventory[0], {
    id: 'beans',
    name: 'Beans',
    quantity: 1.5,
    unit: 'kg',
    expiryDate: undefined,
  });
  assert.deepEqual(result.state.journal[0], consumption);
});

test('creates a purchased item only from matching confirmed values', () => {
  const state: InventoryMutationState<TestItem> = { inventory: [], journal: [] };
  const purchase = mutation({
    inventoryItemId: 'rice',
    source: { type: 'purchase', id: 'purchase-1' },
    quantityDelta: 1,
    unit: 'bag',
  });
  const newItem = { id: 'rice', name: 'Rice', quantity: 1, unit: 'bag' };
  const result = applyInventoryMutation(state, { mutation: purchase, newItem });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.inventory, [newItem]);
  assert.deepEqual(result.state.journal, [purchase]);
});

for (const [label, rejectedMutation] of [
  ['zero quantity', mutation({ quantityDelta: 0 })],
  ['missing source identity', mutation({ source: { type: 'purchase', id: ' ' } })],
  ['incompatible unit', mutation({ unit: 'litre' })],
  ['insufficient stock', mutation({ quantityDelta: -3 })],
] as const) {
  test(`rejects ${label} without changing stock or appending a journal entry`, () => {
    const state = initialState();
    const result = applyInventoryMutation(state, { mutation: rejectedMutation });
    assert.equal(result.accepted, false);
    assert.strictEqual(result.state, state);
    assert.equal(result.state.inventory[0].quantity, 2);
    assert.deepEqual(result.state.journal, []);
  });
}

test('rejects a duplicate mutation without applying stock twice', () => {
  const first = applyInventoryMutation(initialState(), { mutation: mutation() });
  const second = applyInventoryMutation(first.state, { mutation: mutation() });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.strictEqual(second.state, first.state);
  assert.equal(second.state.inventory[0].quantity, 3);
  assert.equal(second.state.journal.length, 1);
});
