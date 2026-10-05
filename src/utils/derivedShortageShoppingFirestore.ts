import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import type { ShoppingItem } from "../types";
import { getScopedDocumentId } from "./cloudCollectionSync";
import {
  isManagedDerivedShortageRow,
  reconcileDerivedShortageShoppingItems,
  type DerivedShortageCandidate,
} from "./derivedShortageShopping";
import { isStoredShoppingItemStructurallyValid } from "./storedShoppingValidation";

export type DerivedShortagePersistenceResult =
  | { outcome: "applied"; next: ShoppingItem[] }
  | { outcome: "no-change"; next: ShoppingItem[] }
  | { outcome: "needs-review"; reason: "invalid-request" | "stale-derived-baseline" };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const comparable = (item: ShoppingItem): ShoppingItem => ({ ...item });

const sameRows = (left: readonly ShoppingItem[], right: readonly ShoppingItem[]): boolean =>
  JSON.stringify([...left].sort((a, b) => a.id.localeCompare(b.id)).map(comparable)) ===
  JSON.stringify([...right].sort((a, b) => a.id.localeCompare(b.id)).map(comparable));

/**
 * Reconciles only reserved shortage-v1 rows. Manual, AI and legacy advisor rows
 * are outside this transaction and therefore cannot be deleted or overwritten.
 */
export async function reconcileDerivedShortagesAtomically(
  db: Firestore,
  userId: string,
  expectedManagedRows: readonly ShoppingItem[],
  candidates: readonly DerivedShortageCandidate[],
): Promise<DerivedShortagePersistenceResult> {
  if (
    !safeUid(userId) ||
    expectedManagedRows.some(
      item => !isStoredShoppingItemStructurallyValid(item) || !isManagedDerivedShortageRow(item),
    ) ||
    new Set(expectedManagedRows.map(item => item.id)).size !== expectedManagedRows.length
  ) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }

  const desired = reconcileDerivedShortageShoppingItems([], candidates).next;
  if (desired.length > 200 || desired.some(item => !isStoredShoppingItemStructurallyValid(item))) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }

  const expectedById = new Map(expectedManagedRows.map(item => [item.id, item]));
  const desiredById = new Map(desired.map(item => [item.id, item]));
  const ids = [...new Set([...expectedById.keys(), ...desiredById.keys()])].sort();

  if (ids.length === 0) {
    return { outcome: "no-change", next: [] };
  }

  return runTransaction(db, async tx => {
    const refs = ids.map(id => doc(db, "shoppingList", getScopedDocumentId(userId, id)));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    const remoteManaged: ShoppingItem[] = [];

    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      const logicalId = ids[index];
      if (!snapshot.exists()) {
        if (expectedById.has(logicalId)) {
          return { outcome: "needs-review" as const, reason: "stale-derived-baseline" as const };
        }
        continue;
      }
      const { userId: remoteUserId, updatedAt: _updatedAt, ...raw } = snapshot.data();
      if (
        remoteUserId !== userId ||
        !isStoredShoppingItemStructurallyValid(raw) ||
        !isManagedDerivedShortageRow(raw) ||
        raw.id !== logicalId
      ) {
        return { outcome: "needs-review" as const, reason: "stale-derived-baseline" as const };
      }
      remoteManaged.push(raw);
    }

    if (!sameRows(remoteManaged, expectedManagedRows)) {
      return { outcome: "needs-review" as const, reason: "stale-derived-baseline" as const };
    }
    if (sameRows(remoteManaged, desired)) {
      return { outcome: "no-change" as const, next: desired };
    }

    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const ref = refs[index];
      const next = desiredById.get(id);
      if (next) {
        tx.set(ref, { ...next, userId, updatedAt: serverTimestamp() });
      } else if (expectedById.has(id)) {
        tx.delete(ref);
      }
    }
    return { outcome: "applied" as const, next: desired };
  });
}

export async function readManagedDerivedShortageRows(
  db: Firestore,
  userId: string,
): Promise<ShoppingItem[] | null> {
  if (!safeUid(userId)) return null;
  const snapshot = await getDocs(
    query(collection(db, "shoppingList"), where("userId", "==", userId)),
  );
  const rows: ShoppingItem[] = [];
  for (const entry of snapshot.docs) {
    const { userId: remoteUserId, updatedAt: _updatedAt, ...raw } = entry.data();
    if (remoteUserId !== userId) return null;
    if (!isStoredShoppingItemStructurallyValid(raw)) continue;
    if (isManagedDerivedShortageRow(raw)) rows.push(raw);
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}
