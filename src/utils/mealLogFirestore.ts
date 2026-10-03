import { collection, doc, Firestore, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import type { MealLog } from "../types";
import { sanitizeStoredMealLog } from "./verifiedMealLog";

export type MealLogAppendResult =
  | { outcome: "applied" | "already-applied"; meal: MealLog }
  | { outcome: "needs-review"; reason: "invalid-request" | "conflict" };

function signature(meal: MealLog): string {
  return JSON.stringify(meal);
}

export function subscribeMealLogs(
  db: Firestore,
  userId: string,
  onMeals: (meals: MealLog[]) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, "users", userId, "mealLogs"),
    snapshot => {
      const meals = snapshot.docs
        .flatMap(row => {
          const meal = sanitizeStoredMealLog({ id: row.id, ...row.data() });
          return meal ? [meal] : [];
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      onMeals(meals);
    },
    onError,
  );
}

export async function appendMealLogAtomically(
  db: Firestore,
  userId: string,
  candidate: MealLog,
): Promise<MealLogAppendResult> {
  const meal = sanitizeStoredMealLog(candidate);
  if (!userId || userId.includes("/") || !meal || meal.id.includes("/")) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ref = doc(db, "users", userId, "mealLogs", meal.id);
  const requestSignature = signature(meal);

  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      const existing = sanitizeStoredMealLog({ id: snapshot.id, ...snapshot.data() });
      if (existing && signature(existing) === requestSignature) {
        return { outcome: "already-applied" as const, meal };
      }
      return { outcome: "needs-review" as const, reason: "conflict" as const };
    }
    tx.set(ref, {
      ...meal,
      userId,
      requestSignature,
      createdAt: serverTimestamp(),
    });
    return { outcome: "applied" as const, meal };
  });
}
