import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { ShoppingItem } from "../types";
import { getScopedDocumentId } from "./cloudCollectionSync";
import { isStoredShoppingItemStructurallyValid } from "./storedShoppingValidation";

export type ShoppingMutationResult =
  | { outcome: "applied" }
  | { outcome: "needs-review"; reason: "invalid-request" | "stale-item" | "missing-item" };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const validItem = (item: unknown): item is ShoppingItem =>
  isStoredShoppingItemStructurallyValid(item);

const comparableItem = (item: ShoppingItem): ShoppingItem => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  unit: item.unit,
  category: item.category,
  ...(item.estimatedPriceEUR !== undefined
    ? { estimatedPriceEUR: item.estimatedPriceEUR } : {}),
  checked: item.checked,
  ...(item.amountOrigin !== undefined ? { amountOrigin: item.amountOrigin } : {}),
  ...(item.purchaseAmountConfirmed !== undefined
    ? { purchaseAmountConfirmed: item.purchaseAmountConfirmed } : {}),
  ...(item.reason !== undefined ? { reason: item.reason } : {}),
});

const sameItem = (a: ShoppingItem, b: ShoppingItem): boolean =>
  JSON.stringify(comparableItem(a)) === JSON.stringify(comparableItem(b));

export async function createShoppingItem(
  db: Firestore,
  userId: string,
  item: ShoppingItem,
): Promise<ShoppingMutationResult> {
  if (!safeUid(userId) || !validItem(item)) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ref = doc(db, "shoppingList", getScopedDocumentId(userId, item.id));
  return runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    if (existing.exists()) return { outcome: "needs-review" as const, reason: "stale-item" as const };
    tx.set(ref, { ...item, userId, updatedAt: serverTimestamp() });
    return { outcome: "applied" as const };
  });
}

export async function replaceShoppingItem(
  db: Firestore,
  userId: string,
  expected: ShoppingItem,
  next: ShoppingItem,
): Promise<ShoppingMutationResult> {
  if (!safeUid(userId) || !validItem(expected) || !validItem(next) ||
      expected.id !== next.id) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ref = doc(db, "shoppingList", getScopedDocumentId(userId, expected.id));
  return runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    if (!existing.exists()) return { outcome: "needs-review" as const, reason: "missing-item" as const };
    const { userId: remoteUserId, updatedAt: _updatedAt, ...remote } = existing.data();
    if (remoteUserId !== userId || !validItem(remote) || !sameItem(remote, expected)) {
      return { outcome: "needs-review" as const, reason: "stale-item" as const };
    }
    tx.set(ref, { ...next, userId, updatedAt: serverTimestamp() });
    return { outcome: "applied" as const };
  });
}

export async function removeShoppingItem(
  db: Firestore,
  userId: string,
  expected: ShoppingItem,
): Promise<ShoppingMutationResult> {
  if (!safeUid(userId) || !validItem(expected)) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ref = doc(db, "shoppingList", getScopedDocumentId(userId, expected.id));
  return runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    if (!existing.exists()) return { outcome: "needs-review" as const, reason: "missing-item" as const };
    const { userId: remoteUserId, updatedAt: _updatedAt, ...remote } = existing.data();
    if (remoteUserId !== userId || !validItem(remote) || !sameItem(remote, expected)) {
      return { outcome: "needs-review" as const, reason: "stale-item" as const };
    }
    tx.delete(ref);
    return { outcome: "applied" as const };
  });
}


export async function createShoppingItems(
  db: Firestore,
  userId: string,
  items: ShoppingItem[],
): Promise<ShoppingMutationResult> {
  if (!safeUid(userId) || items.length < 1 || items.length > 200 ||
      items.some(item => !validItem(item)) ||
      new Set(items.map(item => item.id)).size !== items.length) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  return runTransaction(db, async tx => {
    const refs = ordered.map(item =>
      doc(db, "shoppingList", getScopedDocumentId(userId, item.id))
    );
    const existing = await Promise.all(refs.map(ref => tx.get(ref)));
    if (existing.some(snapshot => snapshot.exists())) {
      return { outcome: "needs-review" as const, reason: "stale-item" as const };
    }
    ordered.forEach((item, index) => {
      tx.set(refs[index], { ...item, userId, updatedAt: serverTimestamp() });
    });
    return { outcome: "applied" as const };
  });
}

export async function clearShoppingItems(
  db: Firestore,
  userId: string,
  expectedItems: ShoppingItem[],
): Promise<ShoppingMutationResult> {
  if (!safeUid(userId) || expectedItems.length < 1 || expectedItems.length > 200 ||
      expectedItems.some(item => !validItem(item)) ||
      new Set(expectedItems.map(item => item.id)).size !== expectedItems.length) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ordered = [...expectedItems].sort((a, b) => a.id.localeCompare(b.id));
  return runTransaction(db, async tx => {
    const refs = ordered.map(item =>
      doc(db, "shoppingList", getScopedDocumentId(userId, item.id))
    );
    const existing = await Promise.all(refs.map(ref => tx.get(ref)));
    for (let index = 0; index < existing.length; index += 1) {
      const snapshot = existing[index];
      if (!snapshot.exists()) {
        return { outcome: "needs-review" as const, reason: "missing-item" as const };
      }
      const { userId: remoteUserId, updatedAt: _updatedAt, ...remote } = snapshot.data();
      if (remoteUserId !== userId || !validItem(remote) ||
          !sameItem(remote, ordered[index])) {
        return { outcome: "needs-review" as const, reason: "stale-item" as const };
      }
    }
    refs.forEach(ref => tx.delete(ref));
    return { outcome: "applied" as const };
  });
}
