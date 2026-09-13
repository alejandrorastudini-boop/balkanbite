import type { PantryItem, PantryPurchaseRecord, ShoppingItem } from '../types';
import { normalizeQuantity } from './quantityUnits';

export interface PantryPurchase {
  sourceId: string;
  name: string;
  nameBg?: string;
  nameEs?: string;
  quantity: number;
  unit: string;
  category?: string;
  estimatedCostEUR?: number;
  expiryDaysLeft?: number;
  source: 'shopping_list' | 'confirmed_reconciliation';
}
export interface PurchaseMergeResult {
  pantry: PantryItem[];
  acceptedSourceIds: string[];
  rejected: Array<{ sourceId: string; name: string; reason: 'invalid_purchase' | 'duplicate_source' | 'quantity_overflow' }>;
}
const nameKey = (value: string) => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ') : '';
const names = (item: { name: string; nameBg?: string; nameEs?: string }) => [item.name, item.nameBg, item.nameEs].map(nameKey).filter(Boolean);
const finiteNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const categories = new Set<PantryItem['category']>(['Produce', 'Dairy', 'Meat/Fish', 'Pantry/Grains', 'Spices', 'Other']);
const safeCategory = (value: string): PantryItem['category'] => categories.has(value as PantryItem['category']) ? value as PantryItem['category'] : 'Other';

/** Historical acquisition evidence, not a ledger of the remaining quantity. */
function legacyRecord(item: PantryItem): PantryPurchaseRecord {
  return {
    sourceId: `legacy:${item.id}`, source: 'pantry_legacy', name: item.name,
    quantity: item.quantity, unit: item.unit, acquiredAt: item.addedAt,
    ...(finiteNonnegative(item.estimatedCostEUR) ? { estimatedCostEUR: item.estimatedCostEUR } : {}),
    ...(finiteNonnegative(item.expiryDaysLeft) ? { expiryDaysLeft: item.expiryDaysLeft } : {}),
  };
}

/** Exact identity/explicit aliases only. No fuzzy food or container-size inference. */
export function mergePurchasesIntoPantry(
  pantry: PantryItem[], purchases: PantryPurchase[], acquiredAt: string
): PurchaseMergeResult {
  const working = pantry.map(item => ({ ...item }));
  const acceptedSourceIds: string[] = [];
  const rejected: PurchaseMergeResult['rejected'] = [];
  const seen = new Set<string>();
  const duplicateIds = new Set(purchases.filter((item, index) => purchases.findIndex(other => other.sourceId === item.sourceId) !== index).map(item => item.sourceId));
  for (const purchase of purchases) {
    const reject = (reason: PurchaseMergeResult['rejected'][number]['reason']) => rejected.push({ sourceId: purchase.sourceId, name: purchase.name, reason });
    const quantity = normalizeQuantity(purchase.quantity, purchase.unit);
    if (!nameKey(purchase.name) || typeof purchase.sourceId !== 'string' || !purchase.sourceId.trim() || !quantity || quantity.baseQuantity <= 0 || !Number.isFinite(quantity.baseQuantity)) {
      reject('invalid_purchase'); continue;
    }
    if (duplicateIds.has(purchase.sourceId)) { reject('duplicate_source'); continue; }
    // A repeated confirmation of the same surviving purchase is a no-op.
    if (seen.has(purchase.sourceId) || working.some(item => item.purchaseHistory?.some(record => record.sourceId === purchase.sourceId))) {
      acceptedSourceIds.push(purchase.sourceId); continue;
    }
    seen.add(purchase.sourceId);
    const purchaseNames = names(purchase);
    const candidates = working.filter(item => {
      const existing = normalizeQuantity(item.quantity, item.unit);
      return existing && Number.isFinite(existing.baseQuantity) && existing.unit.dimension === quantity.unit.dimension && names(item).some(name => purchaseNames.includes(name));
    });
    // An alias shared by distinct named products is ambiguous: keep a separate item.
    const candidate = new Set(candidates.map(item => nameKey(item.name))).size === 1 ? candidates[0] : undefined;
    const record: PantryPurchaseRecord = {
      sourceId: purchase.sourceId, source: purchase.source, name: purchase.name,
      quantity: purchase.quantity, unit: purchase.unit, acquiredAt,
      ...(finiteNonnegative(purchase.estimatedCostEUR) ? { estimatedCostEUR: purchase.estimatedCostEUR } : {}),
      ...(finiteNonnegative(purchase.expiryDaysLeft) ? { expiryDaysLeft: purchase.expiryDaysLeft } : {}),
    };
    if (candidate) {
      const existing = normalizeQuantity(candidate.quantity, candidate.unit)!;
      const combined = (existing.baseQuantity + quantity.baseQuantity) / existing.unit.factorToBase;
      if (!Number.isFinite(combined)) { reject('quantity_overflow'); continue; }
      const merged: PantryItem = {
        ...candidate, quantity: Number(combined.toPrecision(15)),
        category: safeCategory(candidate.category) === 'Other' ? safeCategory(purchase.category) : candidate.category,
        purchaseHistory: [...(candidate.purchaseHistory || [legacyRecord(candidate)]), record],
      };
      // A partial known cost must not look like the total value of all stock.
      merged.estimatedCostEUR = null; // Explicitly clear old values under Firestore merge writes.
      if (finiteNonnegative(candidate.estimatedCostEUR) && finiteNonnegative(record.estimatedCostEUR)) {
        const total = candidate.estimatedCostEUR + record.estimatedCostEUR;
        if (Number.isFinite(total)) merged.estimatedCostEUR = Number(total.toPrecision(15));
      }
      // Retain the earliest known warning without assigning that expiry to all
      // stock. Historical records preserve the distinct acquisition evidence.
      const knownExpiries = [candidate.expiryDaysLeft, record.expiryDaysLeft].filter(finiteNonnegative);
      if (knownExpiries.length) {
        merged.expiryDaysLeft = Math.min(...knownExpiries);
        merged.expiryIsPartial = true;
      } else {
        delete merged.expiryDaysLeft;
        delete merged.expiryIsPartial;
      }
      working[working.indexOf(candidate)] = merged;
    } else {
      const id = `purchase-${purchase.sourceId}`;
      if (working.some(item => item.id === id)) { reject('duplicate_source'); continue; }
      working.push({
        id, name: purchase.name.trim(), quantity: purchase.quantity, unit: purchase.unit.trim(),
        category: safeCategory(purchase.category), addedAt: acquiredAt,
        ...(nameKey(purchase.nameBg) ? { nameBg: purchase.nameBg.trim() } : {}),
        ...(nameKey(purchase.nameEs) ? { nameEs: purchase.nameEs.trim() } : {}),
        ...(record.estimatedCostEUR !== undefined ? { estimatedCostEUR: record.estimatedCostEUR } : {}),
        ...(record.expiryDaysLeft !== undefined ? { expiryDaysLeft: record.expiryDaysLeft } : {}),
        purchaseHistory: [record],
      });
    }
    acceptedSourceIds.push(purchase.sourceId);
  }
  return { pantry: working, acceptedSourceIds, rejected };
}

export function shoppingItemToPurchase(item: ShoppingItem): PantryPurchase {
  return {
    sourceId: `shopping:${item.id}`, source: 'shopping_list', name: item.name,
    quantity: item.quantity, unit: item.unit, category: item.category,
    // Existing shopping prices are estimates of a line total. Zero is its
    // unknown-price sentinel; copying them does not verify their origin.
    ...(finiteNonnegative(item.estimatedPriceEUR) && item.estimatedPriceEUR > 0 ? { estimatedCostEUR: item.estimatedPriceEUR } : {}),
  };
}

export function transferCheckedShoppingItems(pantry: PantryItem[], shoppingList: ShoppingItem[], acquiredAt: string) {
  const result = mergePurchasesIntoPantry(pantry, shoppingList.filter(item => item.checked).map(shoppingItemToPurchase), acquiredAt);
  const accepted = new Set(result.acceptedSourceIds);
  return { ...result, shoppingList: shoppingList.filter(item => !item.checked || !accepted.has(`shopping:${item.id}`)) };
}
