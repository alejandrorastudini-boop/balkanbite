import { collection, doc, Firestore, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import type { MealPlanDay, Recipe } from "../types";
import { getScopedDocumentId } from "./cloudCollectionSync";
import { isStoredMealPlanDayStructurallyValid } from "./storedMealPlanValidation";
import { isStoredRecipeStructurallyValid } from "./storedRecipeValidation";

export type DerivedCollectionName = "recipes" | "mealPlans";
export type DerivedCollectionItem = Recipe | MealPlanDay;
export type DerivedCollectionMutationResult =
  | { outcome: "applied" | "already-applied" }
  | { outcome: "needs-review"; reason: "invalid-request" | "stale-state" | "unverified-authority" };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("/");

const logicalId = (collectionName: DerivedCollectionName, item: DerivedCollectionItem) =>
  collectionName === "recipes" ? (item as Recipe).id : (item as MealPlanDay).date;

const valid = (collectionName: DerivedCollectionName, item: unknown): item is DerivedCollectionItem =>
  collectionName === "recipes"
    ? isStoredRecipeStructurallyValid(item)
    : isStoredMealPlanDayStructurallyValid(item);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const stable = (value: unknown) => JSON.stringify(canonicalize(value));

const comparable = (data: Record<string, unknown>) => {
  const { userId: _userId, updatedAt: _updatedAt, ...rest } = data;
  return rest;
};

export async function replaceDerivedCollectionAtomically(
  db: Firestore,
  userId: string,
  collectionName: DerivedCollectionName,
  expectedItems: readonly DerivedCollectionItem[],
  nextItems: readonly DerivedCollectionItem[],
): Promise<DerivedCollectionMutationResult> {
  if (!safeUid(userId) || expectedItems.length > 200 || nextItems.length > 200 ||
      expectedItems.some(item => !valid(collectionName, item)) ||
      nextItems.some(item => !valid(collectionName, item))) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }

  const expectedById = new Map(expectedItems.map(item => [logicalId(collectionName, item), item]));
  const nextById = new Map(nextItems.map(item => [logicalId(collectionName, item), item]));
  if (expectedById.size !== expectedItems.length || nextById.size !== nextItems.length) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }

  const ownerQuery = query(collection(db, collectionName), where("userId", "==", userId));
  const observed = await getDocs(ownerQuery);
  const canonicalObserved = observed.docs.filter(snapshot =>
    snapshot.id === getScopedDocumentId(userId, String(snapshot.data().id ?? snapshot.data().date ?? ""))
  );
  const observedMatches = (target: Map<string, DerivedCollectionItem>): boolean => {
    if (canonicalObserved.length !== target.size) return false;
    return canonicalObserved.every(snapshot => {
      const data = snapshot.data();
      const id = String(data.id ?? data.date ?? "");
      const targetItem = target.get(id);
      return Boolean(
        targetItem &&
        valid(collectionName, comparable(data)) &&
        stable(comparable(data)) === stable(targetItem)
      );
    });
  };

  const matchesExpected = observedMatches(expectedById);
  const matchesNext = observedMatches(nextById);
  if (!matchesExpected && matchesNext) {
    return { outcome: "already-applied" };
  }
  if (!matchesExpected) {
    return { outcome: "needs-review", reason: "stale-state" };
  }
  if (matchesNext) {
    return { outcome: "already-applied" };
  }

  return runTransaction(db, async tx => {
    const allIds = Array.from(new Set([...expectedById.keys(), ...nextById.keys()])).sort();
    const refs = allIds.map(id => doc(db, collectionName, getScopedDocumentId(userId, id)));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));

    const transactionMatchesNext = allIds.every((id, index) => {
      const snapshot = snapshots[index];
      const next = nextById.get(id);
      if (!next) return !snapshot.exists();
      if (!snapshot.exists()) return false;
      const data = snapshot.data();
      return data.userId === userId &&
        valid(collectionName, comparable(data)) &&
        stable(comparable(data)) === stable(next);
    });
    if (transactionMatchesNext) {
      return { outcome: "already-applied" as const };
    }

    for (let index = 0; index < allIds.length; index += 1) {
      const id = allIds[index];
      const snapshot = snapshots[index];
      const expected = expectedById.get(id);
      if (expected) {
        if (!snapshot.exists()) return { outcome: "needs-review" as const, reason: "stale-state" as const };
        const data = snapshot.data();
        if (data.userId !== userId || !valid(collectionName, comparable(data)) ||
            stable(comparable(data)) !== stable(expected)) {
          return { outcome: "needs-review" as const, reason: "stale-state" as const };
        }
      } else if (snapshot.exists()) {
        return { outcome: "needs-review" as const, reason: "stale-state" as const };
      }
    }

    for (let index = 0; index < allIds.length; index += 1) {
      const id = allIds[index];
      const ref = refs[index];
      const next = nextById.get(id);
      if (next) tx.set(ref, { ...next, userId, updatedAt: serverTimestamp() });
      else tx.delete(ref);
    }
    return { outcome: "applied" as const };
  });
}
