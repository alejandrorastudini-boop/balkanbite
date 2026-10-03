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

const stable = (value: unknown) => JSON.stringify(value);

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
  if (canonicalObserved.length !== expectedById.size) {
    return { outcome: "needs-review", reason: "stale-state" };
  }
  for (const snapshot of canonicalObserved) {
    const data = snapshot.data();
    const id = String(data.id ?? data.date ?? "");
    const expected = expectedById.get(id);
    if (!expected || !valid(collectionName, comparable(data)) ||
        stable(comparable(data)) !== stable(expected)) {
      return { outcome: "needs-review", reason: "stale-state" };
    }
  }

  return runTransaction(db, async tx => {
    const allIds = Array.from(new Set([...expectedById.keys(), ...nextById.keys()])).sort();
    const refs = allIds.map(id => doc(db, collectionName, getScopedDocumentId(userId, id)));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));

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
