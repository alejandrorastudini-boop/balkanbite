import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe, ShoppingItem, MealPlanDay } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import { GUEST_COOK_INTENT_KEY } from "../src/utils/guestConfirmedCookIntent";
import { GUEST_PURCHASE_INTENT_KEY } from "../src/utils/guestConfirmedPurchaseIntent";
import { GUEST_PANTRY_SHOPPING_JOURNAL_KEY } from "../src/utils/guestPantryShoppingJournal";
import {
  GUEST_COOK_DERIVED_INTENT_KEY as INTENT,
  commitDerivedGuestCookIntent,
  recoverDerivedGuestCookIntent,
  type DerivedGuestCookCommand,
} from "../src/utils/guestCookDerivedIntent";
import { deductRecipeIngredientsFromPantry } from "../src/utils/pantryConsumption";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "../src/utils/derivedShortageShopping";

const PROGRESSION = "balkanbite_progression";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const SHOPPING = "balkanbite_shopping";
const keys = [GUEST_PANTRY_KEY, RECIPES, PLAN, SHOPPING, PROGRESSION];

const stock: PantryItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 150, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-14",
}];
const recipe: Recipe = {
  id: "qa-rice-dinner", title: { en: "QA Rice", es: "Arroz QA", bg: "Ориз QA" },
  description: { en: "QA", es: "QA", bg: "QA" },
  prepTimeMin: 0, cookTimeMin: 0, costPerServingEUR: 0,
  difficulty: "easy", servings: 1, calories: 0, proteinG: 0, carbsG: 0,
  fatG: 0, fiberG: 0, tags: [],
  ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const manual: ShoppingItem = {
  id: "manual-salt", name: "QA Salt", quantity: 1, unit: "kg",
  checked: false, category: "Other", amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};
const shopping: ShoppingItem[] = [manual];
const when = "2026-10-16T14:00:00.000Z";
const oldRecipes = [recipe];
const oldPlan: MealPlanDay[] = [];
const newPlan: MealPlanDay[] = [{ date: "2026-10-16", breakfast: recipe }];
const consumed = deductRecipeIngredientsFromPantry(stock, recipe.ingredients, new Date(when));
assert.equal(consumed.issues.length, 0);
const afterRecipes = syncRecipesWithPantry(oldRecipes, consumed.pantry, new Date(when));
const afterShopping = reconcileDerivedShortageShoppingItems(
  shopping, evaluateShoppingNeeds(consumed.pantry, newPlan, shopping, "en", new Date(when)).itemsToAddToShoppingList,
).next;
const createCommand = (): DerivedGuestCookCommand => ({
  cookConfirmationId: "cook-derived-test-1",
  recipeId: recipe.id,
  occurredAt: when,
  language: "en",
  expectedPantry: stock,
  expectedRecipes: oldRecipes,
  expectedPlan: oldPlan,
  expectedShopping: shopping,
  expectedProgression: [],
  nextRecipes: afterRecipes,
  nextPlan: newPlan,
  nextShopping: afterShopping,
});
type Failure = "throw" | "silent";
function fixture() {
  const data = new Map<string,string>([
    [GUEST_PANTRY_KEY, JSON.stringify(stock)], [RECIPES, JSON.stringify(oldRecipes)],
    [PLAN, JSON.stringify(oldPlan)], [SHOPPING, JSON.stringify(shopping)],
    [PROGRESSION, "[]"],
  ]);
  const fault = new Map<string, Failure>();
  const writes = new Map<string, number>();
  let skipRemove = false;
  const storage = {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) {
      if (fault.get(key) === "throw") throw new Error("synthetic storage quota");
      if (fault.get(key) === "silent") return;
      writes.set(key, (writes.get(key) ?? 0) + 1);
      data.set(key, value);
    },
    removeItem(key: string) { if (!skipRemove) data.delete(key); },
  };
  return {
    storage, data, fault, writes, skipRemove: (v: boolean) => {skipRemove=v;},
  };
}
const quantity = (f: ReturnType<typeof fixture>) =>
  JSON.parse(f.data.get(GUEST_PANTRY_KEY)!)?.[0]?.quantity as number;
function assertCompleted(f: ReturnType<typeof fixture>) {
  assert.equal(quantity(f), 50, "confirmed cook deduction is applied exactly once");
  assert.deepEqual(JSON.parse(f.data.get(RECIPES)!), afterRecipes);
  assert.deepEqual(JSON.parse(f.data.get(PLAN)!), newPlan);
  assert.deepEqual(JSON.parse(f.data.get(SHOPPING)!), afterShopping);
  assert.deepEqual(JSON.parse(f.data.get(SHOPPING)!).filter((x: ShoppingItem) => x.id === manual.id), [manual]);
  const ledger = JSON.parse(f.data.get(PROGRESSION)!);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].eventId, "cook:cook-derived-test-1");
  assert.equal(f.data.get(INTENT), undefined);
}

test("full five-key derived cook commits deterministic projections and exactly one event", () => {
  assert.ok(afterShopping.some(row => row.id !== manual.id),
    "dated test must exercise a changed shortage-shopping projection");
  const f = fixture();
  assert.ok(afterRecipes[0].ingredients[0].inPantry === false, "stock causes real recipe availability change");
  assert.equal(newPlan.length, 1);
  assert.deepEqual(commitDerivedGuestCookIntent(f.storage, createCommand()), { status: "saved" });
  assertCompleted(f);
  assert.equal(f.writes.get(GUEST_PANTRY_KEY), 1);
  assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), { status: "none" });
});

test("silent or thrown journal write aborts before stock, menu or progress", () => {
  for (const kind of ["silent", "throw"] as const) {
    const f = fixture();
    f.fault.set(INTENT, kind);
    assert.deepEqual(commitDerivedGuestCookIntent(f.storage, createCommand()), {
      status: "blocked", reason: "storage-unavailable",
    });
    for (const key of keys) assert.equal(f.writes.get(key) ?? 0, 0);
    assert.equal(f.data.get(INTENT), undefined);
  }
});

test("failure of any individual of five keys is recovered as a prefix, no second deduction", () => {
  for (const kind of ["silent", "throw"] as const) for (const broken of keys) {
    const f = fixture();
    f.fault.set(broken, kind);
    const outcome = commitDerivedGuestCookIntent(f.storage, createCommand());
    assert.equal(outcome.status, "blocked", `failure of ${broken} must not claim success`);
    assert.ok(f.data.has(INTENT), `journal survives ${broken} failure`);
    f.fault.clear();
    const recovered = recoverDerivedGuestCookIntent(f.storage);
    if (broken === GUEST_PANTRY_KEY) {
      assert.deepEqual(recovered, { status: "unapplied" });
      assert.equal(quantity(f), 150);
      assert.equal(f.writes.get(GUEST_PANTRY_KEY) ?? 0, 0);
      assert.equal(f.writes.get(PROGRESSION) ?? 0, 0);
    } else {
      assert.deepEqual(recovered, { status: "completed-derived-writes" });
      assertCompleted(f);
      assert.equal(f.writes.get(GUEST_PANTRY_KEY), 1);
      assert.equal(f.writes.get(PROGRESSION), 1);
      assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), { status: "none" });
    }
  }
});

test("invalid source, stale snapshot or invalid unit blocks without creating journal", () => {
  for (const key of keys) {
    const f = fixture();
    f.data.set(key, "{historical unknown");
    assert.equal(commitDerivedGuestCookIntent(f.storage, createCommand()).status, "blocked");
    assert.equal(f.data.get(key), "{historical unknown");
    assert.equal(f.data.get(INTENT), undefined);
  }
  const a = fixture();
  a.data.set(GUEST_PANTRY_KEY, JSON.stringify([{ ...stock[0], quantity: 120 }]));
  assert.deepEqual(commitDerivedGuestCookIntent(a.storage, createCommand()), {
    status: "blocked", reason: "stale-snapshot",
  });
  const b = fixture();
  assert.equal(commitDerivedGuestCookIntent(b.storage, {
    ...createCommand(), nextRecipes: [{ ...recipe, ingredients: [{ ...recipe.ingredients[0], inPantry: true }] }],
  }).status, "blocked");
  assert.equal(b.data.get(INTENT), undefined);
});

test("forged shopping projections or manual-row edits do not become authoritative", () => {
  const f = fixture();
  const forged = [{ ...manual, quantity: 999 }];
  assert.deepEqual(commitDerivedGuestCookIntent(f.storage, {
    ...createCommand(), nextShopping: forged,
  }), { status: "blocked", reason: "invalid-input" });
  assert.equal(f.data.get(INTENT), undefined);
  assert.deepEqual(JSON.parse(f.data.get(SHOPPING)!), shopping);
});

test("changed external source after partial cook stops recovery; never overwrites it", () => {
  for (const key of keys) {
    const f = fixture();
    f.fault.set(PROGRESSION, "silent");
    assert.equal(commitDerivedGuestCookIntent(f.storage, createCommand()).status, "blocked");
    f.fault.clear();
    const external = key === GUEST_PANTRY_KEY
      ? JSON.stringify([{ ...stock[0], quantity: 23 }])
      : '[{"manual":"external-update"}]';
    f.data.set(key, external);
    assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), {
      status: "blocked", reason: "conflict",
    });
    assert.equal(f.data.get(key), external);
    assert.ok(f.data.has(INTENT));
  }
});

test("tampering with journal or a malformed marker never rewrites stock", () => {
  for (const invalid of ["{broken", '{"version":2}', '{"version":1}']) {
    const f = fixture();
    f.data.set(INTENT, invalid);
    assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), {
      status: "blocked", reason: "invalid-intent",
    });
    assert.equal(quantity(f), 150);
    assert.equal(f.data.get(INTENT), invalid);
  }
  const f = fixture();
  f.fault.set(PROGRESSION, "silent");
  commitDerivedGuestCookIntent(f.storage, createCommand());
  f.fault.clear();
  const tampered = JSON.parse(f.data.get(INTENT)!);
  tampered.after[0] = JSON.stringify(stock);
  f.data.set(INTENT, JSON.stringify(tampered));
  assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), {
    status: "blocked", reason: "invalid-intent",
  });
  assert.equal(quantity(f), 50);
});

test("other three journal types prevent new derived cook and prevent conflicting recovery", () => {
  for (const marker of [GUEST_COOK_INTENT_KEY, GUEST_PURCHASE_INTENT_KEY,
    GUEST_PANTRY_SHOPPING_JOURNAL_KEY]) {
    const f = fixture();
    f.data.set(marker, "pending");
    assert.deepEqual(commitDerivedGuestCookIntent(f.storage, createCommand()), {
      status: "blocked", reason: "unresolved-intent",
    });
    assert.equal(f.writes.get(GUEST_PANTRY_KEY) ?? 0, 0);
    f.data.delete(marker);
    f.fault.set(PROGRESSION, "silent");
    commitDerivedGuestCookIntent(f.storage, createCommand());
    f.fault.clear();
    f.data.set(marker, "other-pending");
    assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), {
      status: "blocked", reason: "conflict",
    });
    assert.ok(f.data.get(INTENT));
  }
});

test("marker cleanup failure leaves evidence; later recovery finalizes without rewrites", () => {
  const f = fixture();
  f.skipRemove(true);
  assert.deepEqual(commitDerivedGuestCookIntent(f.storage, createCommand()), {
    status: "saved-pending-cleanup",
  });
  f.skipRemove(false);
  assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), { status: "already-complete" });
  assertCompleted(f);
  assert.equal(f.writes.get(GUEST_PANTRY_KEY), 1);
  assert.equal(f.writes.get(PROGRESSION), 1);
});

test("silent failure on retry remains visible and unconfirmed", () => {
  const f = fixture();
  f.fault.set(PLAN, "silent");
  assert.equal(commitDerivedGuestCookIntent(f.storage, createCommand()).status, "blocked");
  f.fault.set(PLAN, "silent");
  assert.deepEqual(recoverDerivedGuestCookIntent(f.storage), {
    status: "blocked", reason: "storage-unavailable",
  });
  assert.ok(f.data.has(INTENT));
  assert.equal(quantity(f), 50);
});
