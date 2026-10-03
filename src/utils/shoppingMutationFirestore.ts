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

const sameItem = (a: ShoppingItem, b: ShoppingItem): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

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
