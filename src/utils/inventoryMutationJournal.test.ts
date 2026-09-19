import { describe, expect, it } from 'vitest';
import {
  applyInventoryMutation,
  type InventoryMutationRecord,
  type InventoryMutationState,
} from './inventoryMutationJournal';

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

describe('applyInventoryMutation', () => {
  it('records source, signed quantity and unit for an accepted adjustment', () => {
    const result = applyInventoryMutation(initialState(), { mutation: mutation() });

    expect(result.accepted).toBe(true);
    expect(result.state.inventory[0]).toEqual({ id: 'beans', name: 'Beans', quantity: 3, unit: 'kg' });
    expect(result.state.journal).toEqual([mutation()]);
  });

  it('preserves unknown item fields when applying a consumption mutation', () => {
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

    expect(result.accepted).toBe(true);
    expect(result.state.inventory[0]).toEqual({
      id: 'beans',
      name: 'Beans',
      quantity: 1.5,
      unit: 'kg',
      expiryDate: undefined,
    });
    expect(result.state.journal[0]).toMatchObject({
      source: { type: 'consumption', id: 'meal-1' },
      quantityDelta: -0.5,
      unit: 'kg',
    });
  });

  it('creates a purchased item only from matching confirmed values', () => {
    const state: InventoryMutationState<TestItem> = { inventory: [], journal: [] };
    const purchase = mutation({
      inventoryItemId: 'rice',
      source: { type: 'purchase', id: 'purchase-1' },
      quantityDelta: 1,
      unit: 'bag',
    });
    const newItem = { id: 'rice', name: 'Rice', quantity: 1, unit: 'bag' };

    const result = applyInventoryMutation(state, { mutation: purchase, newItem });

    expect(result.accepted).toBe(true);
    expect(result.state.inventory).toEqual([newItem]);
    expect(result.state.journal).toEqual([purchase]);
  });

  it.each([
    ['zero quantity', mutation({ quantityDelta: 0 })],
    ['missing source identity', mutation({ source: { type: 'purchase', id: ' ' } })],
    ['incompatible unit', mutation({ unit: 'litre' })],
    ['insufficient stock', mutation({ quantityDelta: -3 })],
  ])('rejects %s without changing stock or appending a journal entry', (_label, rejectedMutation) => {
    const state = initialState();
    const result = applyInventoryMutation(state, { mutation: rejectedMutation });

    expect(result.accepted).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.inventory[0].quantity).toBe(2);
    expect(result.state.journal).toEqual([]);
  });

  it('rejects a duplicate mutation without applying stock twice', () => {
    const first = applyInventoryMutation(initialState(), { mutation: mutation() });
    const second = applyInventoryMutation(first.state, { mutation: mutation() });

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.state).toBe(first.state);
    expect(second.state.inventory[0].quantity).toBe(3);
    expect(second.state.journal).toHaveLength(1);
  });
});
