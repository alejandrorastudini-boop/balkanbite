export type InventoryMutationSourceType = 'purchase' | 'manual-adjustment' | 'consumption';

export interface InventoryMutationSource {
  type: InventoryMutationSourceType;
  id: string;
}

export interface InventoryMutationRecord {
  id: string;
  inventoryItemId: string;
  source: InventoryMutationSource;
  /** Signed change in the inventory item's own unit. */
  quantityDelta: number;
  unit: string;
  occurredAt: string;
}

export interface JournaledInventoryItem {
  id: string;
  quantity: number;
  unit: string;
}

export interface InventoryMutationState<T extends JournaledInventoryItem> {
  inventory: readonly T[];
  journal: readonly InventoryMutationRecord[];
}

export interface InventoryMutationInput<T extends JournaledInventoryItem> {
  mutation: InventoryMutationRecord;
  /** Required only when a positive mutation creates a new inventory item. */
  newItem?: T;
}

export type InventoryMutationRejection =
  | 'INVALID_MUTATION'
  | 'DUPLICATE_MUTATION'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_NEW_ITEM'
  | 'UNIT_MISMATCH'
  | 'INSUFFICIENT_STOCK';

export type InventoryMutationResult<T extends JournaledInventoryItem> =
  | { accepted: true; state: InventoryMutationState<T> }
  | { accepted: false; reason: InventoryMutationRejection; state: InventoryMutationState<T> };

const isNonBlank = (value: string): boolean => value.trim().length > 0;

/**
 * Applies one confirmed stock mutation and appends its audit record atomically.
 * It performs no unit conversion and never generates source identity, quantity,
 * unit, IDs, or timestamps. Rejections return the original state unchanged.
 */
export function applyInventoryMutation<T extends JournaledInventoryItem>(
  state: InventoryMutationState<T>,
  input: InventoryMutationInput<T>,
): InventoryMutationResult<T> {
  const { mutation, newItem } = input;
  const validMutation =
    isNonBlank(mutation.id) &&
    isNonBlank(mutation.inventoryItemId) &&
    isNonBlank(mutation.source.id) &&
    isNonBlank(mutation.unit) &&
    isNonBlank(mutation.occurredAt) &&
    Number.isFinite(mutation.quantityDelta) &&
    mutation.quantityDelta !== 0;

  if (!validMutation) {
    return { accepted: false, reason: 'INVALID_MUTATION', state };
  }

  if (state.journal.some(record => record.id === mutation.id)) {
    return { accepted: false, reason: 'DUPLICATE_MUTATION', state };
  }

  const itemIndex = state.inventory.findIndex(item => item.id === mutation.inventoryItemId);
  if (itemIndex === -1) {
    if (!newItem) {
      return { accepted: false, reason: 'ITEM_NOT_FOUND', state };
    }

    const validNewItem =
      mutation.quantityDelta > 0 &&
      newItem.id === mutation.inventoryItemId &&
      newItem.unit === mutation.unit &&
      Number.isFinite(newItem.quantity) &&
      newItem.quantity === mutation.quantityDelta;

    if (!validNewItem) {
      return { accepted: false, reason: 'INVALID_NEW_ITEM', state };
    }

    return {
      accepted: true,
      state: {
        inventory: [...state.inventory, newItem],
        journal: [...state.journal, mutation],
      },
    };
  }

  const currentItem = state.inventory[itemIndex];
  if (currentItem.unit !== mutation.unit) {
    return { accepted: false, reason: 'UNIT_MISMATCH', state };
  }

  const nextQuantity = currentItem.quantity + mutation.quantityDelta;
  if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
    return { accepted: false, reason: 'INSUFFICIENT_STOCK', state };
  }

  const inventory = [...state.inventory];
  inventory[itemIndex] = { ...currentItem, quantity: nextQuantity };

  return {
    accepted: true,
    state: {
      inventory,
      journal: [...state.journal, mutation],
    },
  };
}
