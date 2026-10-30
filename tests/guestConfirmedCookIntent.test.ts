import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import { GUEST_PANTRY_SHOPPING_JOURNAL_KEY } from "../src/utils/guestPantryShoppingJournal";
import { GUEST_PURCHASE_INTENT_KEY } from "../src/utils/guestConfirmedPurchaseIntent";
import {
  GUEST_COOK_INTENT_KEY as INTENT,
  commitConfirmedGuestCookIntent,
  recoverConfirmedGuestCookIntent,
} from "../src/utils/guestConfirmedCookIntent";

const PROGRESSION = "balkanbite_progression";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const SHOPPING = "balkanbite_shopping";
const pantry: PantryItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 500, unit: "g",
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
const command = () => ({
  cookConfirmationId: "cook-qa-confirmation-0001",
  recipeId: recipe.id, occurredAt: "2026-10-16T10:00:00.000Z",
  expectedPantry: pantry, expectedProgression: [],
  expectedIngredients: recipe.ingredients,
});
type Failure = "throw" | "silent";
function fixture() {
  const data = new Map([
    [GUEST_PANTRY_KEY, JSON.stringify(pantry)],
    [RECIPES, JSON.stringify([recipe])],
    [PLAN, "[]"],
    [SHOPPING, "[]"],
    [PROGRESSION, "[]"],
  ]);
  const failures = new Map<string, Failure>();
  let stockWrites = 0;
  let ledgerWrites = 0;
  let skipRemoval = false;
  const storage = {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) {
      if (failures.get(key) === "throw") throw new Error("synthetic quota fault");
      if (failures.get(key) === "silent") return;
      if (key === GUEST_PANTRY_KEY) stockWrites++;
      if (key === PROGRESSION) ledgerWrites++;
      data.set(key, value);
    },
    removeItem(key: string) { if (!skipRemoval) data.delete(key); },
  };
  return {
    data, failures, storage,
    get stockWrites() { return stockWrites; },
    get ledgerWrites() { return ledgerWrites; },
    skipRemoval: (val: boolean) => { skipRemoval = val; },
  };
}
function verifyDeducted(f: ReturnType<typeof fixture>) {
  const stored: PantryItem[] = JSON.parse(f.data.get(GUEST_PANTRY_KEY)!);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].quantity, 400);
}
function verifyEvent(f: ReturnType<typeof fixture>) {
  const ledger = JSON.parse(f.data.get(PROGRESSION)!);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].eventId, "cook:cook-qa-confirmation-0001");
  assert.equal(ledger[0].evidenceCount, 1);
  assert.equal(ledger[0].type, "recipe_cook_inventory_applied");
}

test("guest cook journals confirmed deduction exactly once with deterministic progress", () => {
  const f = fixture();
  assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), { status: "saved" });
  verifyDeducted(f); verifyEvent(f);
  assert.equal(f.data.get(INTENT), undefined);
  assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), { status: "none" });
  assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, {
    ...command(), expectedPantry: JSON.parse(f.data.get(GUEST_PANTRY_KEY)!),
    expectedProgression: JSON.parse(f.data.get(PROGRESSION)!),
  }), { status: "already-applied" });
  assert.equal(f.stockWrites, 1, "same confirmation cannot deduct twice");
});

test("invalid or missing confirmation and invalid recipe never stage or deduct", () => {
  for (const opts of [
    { cookConfirmationId: "" },
    { cookConfirmationId: "invalid id" },
    { recipeId: "unknown" },
    { occurredAt: "bad-date" },
    { expectedIngredients: [{ name: "QA Rice", amount: 200, unit: "g", inPantry: true }] },
  ]) {
    const f = fixture();
    const result = commitConfirmedGuestCookIntent(f.storage, { ...command(), ...opts });
    assert.equal(result.status, "blocked");
    assert.equal(f.stockWrites, 0);
    assert.equal(f.data.get(INTENT), undefined);
  }
});

test("unknown/malformed pantry recipes, mealplan, shopping, and progression stay untouched", () => {
  for (const key of [GUEST_PANTRY_KEY, RECIPES, PLAN, SHOPPING, PROGRESSION]) {
    const f = fixture();
    f.data.set(key, "{broken historical bytes");
    const before = f.data.get(key);
    assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
    assert.equal(f.stockWrites, 0);
    assert.equal(f.data.get(INTENT), undefined);
    assert.equal(f.data.get(key), before);
  }
});

test("stale React pantry and progression snapshots do not mutate another tab", () => {
  for (const key of [GUEST_PANTRY_KEY, PROGRESSION]) {
    const f = fixture();
    f.data.set(key, key === GUEST_PANTRY_KEY
      ? JSON.stringify([{ ...pantry[0], quantity: 480 }])
      : JSON.stringify([{ version: 1, eventId: "purchase:external",
        type: "confirmed_purchase_applied", occurredAt: "2026-10-16T08:00:00Z",
        evidence: "deterministic_state_transition", evidenceCount: 1 }]));
    assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), {
      status: "blocked", reason: "stale-snapshot",
    });
    assert.equal(f.stockWrites, 0);
  }
});

test("invalid or silently dropped journal prevents pantry write", () => {
  for (const failure of ["silent", "throw"] as const) {
    const f = fixture();
    f.failures.set(INTENT, failure);
    assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), {
      status: "blocked", reason: "storage-unavailable",
    });
    assert.equal(f.stockWrites, 0);
    assert.equal(f.ledgerWrites, 0);
  }
});

test("failed pantry write is discarded on recovery without cooking", () => {
  for (const failure of ["silent", "throw"] as const) {
    const f = fixture();
    f.failures.set(GUEST_PANTRY_KEY, failure);
    assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
    assert.ok(f.data.has(INTENT));
    f.failures.clear();
    assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), { status: "unapplied" });
    assert.equal(f.stockWrites, 0);
    assert.equal(f.ledgerWrites, 0);
    assert.equal(f.data.get(INTENT), undefined);
  }
});

test("fault after stock deduction replays only progress, not consumption", () => {
  for (const failure of ["silent", "throw"] as const) {
    const f = fixture();
    f.failures.set(PROGRESSION, failure);
    assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
    verifyDeducted(f);
    assert.deepEqual(JSON.parse(f.data.get(PROGRESSION)!), []);
    assert.ok(f.data.has(INTENT));
    f.failures.clear();
    assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), { status: "progression-replayed" });
    verifyDeducted(f); verifyEvent(f);
    assert.equal(f.stockWrites, 1);
    assert.equal(f.ledgerWrites, 1);
    assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), { status: "none" });
  }
});

test("cleanup failure retains journal and recovery is idempotent", () => {
  const f = fixture();
  f.skipRemoval(true);
  assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), {
    status: "saved-pending-cleanup",
  });
  f.skipRemoval(false);
  assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), { status: "already-complete" });
  verifyDeducted(f); verifyEvent(f);
  assert.equal(f.stockWrites, 1); assert.equal(f.ledgerWrites, 1);
});

test("other pending quantity or purchase WAL prevents new cook", () => {
  for (const key of [GUEST_PANTRY_SHOPPING_JOURNAL_KEY, GUEST_PURCHASE_INTENT_KEY, INTENT]) {
    const f = fixture();
    f.data.set(key, "pending");
    assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), {
      status: "blocked", reason: "unresolved-intent",
    });
    assert.equal(f.stockWrites, 0);
  }
});

test("changed recipes, menu, shopping, progression or pantry blocks replay", () => {
  for (const key of [RECIPES, PLAN, SHOPPING, PROGRESSION, GUEST_PANTRY_KEY]) {
    const f = fixture();
    f.failures.set(PROGRESSION, "silent");
    assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
    f.failures.clear();
    const changed = key === GUEST_PANTRY_KEY
      ? JSON.stringify([{ ...pantry[0], quantity: 350 }])
      : key === PROGRESSION
      ? JSON.stringify([{ version: 1, eventId: "purchase:other",
        type: "confirmed_purchase_applied", occurredAt: "2026-10-16T10:01:00Z",
        evidence: "deterministic_state_transition", evidenceCount: 1 }])
      : '[{"external":"update"}]';
    f.data.set(key, changed);
    assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), {
      status: "blocked", reason: "conflict",
    });
    assert.equal(f.data.get(key), changed);
    assert.ok(f.data.has(INTENT));
    assert.equal(f.stockWrites, 1);
  }
});

test("malformed and tampered journal cannot overwrite stock or invent progression", () => {
  for (const invalid of ["{not json", '{"version":2}', '{"version":1}']) {
    const f = fixture();
    f.data.set(INTENT, invalid);
    assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), {
      status: "blocked", reason: "invalid-intent",
    });
    assert.equal(f.data.get(INTENT), invalid);
    assert.equal(f.ledgerWrites, 0);
  }
  const f = fixture();
  f.failures.set(PROGRESSION, "silent");
  assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
  f.failures.clear();
  const marker = JSON.parse(f.data.get(INTENT)!);
  marker.progressionAfter = "[]";
  f.data.set(INTENT, JSON.stringify(marker));
  assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), {
    status: "blocked", reason: "invalid-intent",
  });
  assert.equal(f.ledgerWrites, 0);
});

test("legacy recipe cook cannot stage over pending derived cook journal", () => {
  const f = fixture();
  f.data.set("balkanbite_guest_cook_derived_intent_v1", "unfinished-derived");
  assert.deepEqual(commitConfirmedGuestCookIntent(f.storage, command()), {
    status: "blocked", reason: "unresolved-intent",
  });
  assert.equal(f.stockWrites, 0);
  assert.equal(f.data.get(INTENT), undefined);
});

test("legacy cook recovery preserves ledger when another derived journal appears", () => {
  const f = fixture();
  f.failures.set(PROGRESSION, "silent");
  assert.equal(commitConfirmedGuestCookIntent(f.storage, command()).status, "blocked");
  f.failures.clear();
  f.data.set("balkanbite_guest_cook_derived_intent_v1", "conflicting-derived");
  assert.deepEqual(recoverConfirmedGuestCookIntent(f.storage), {
    status: "blocked", reason: "conflict",
  });
  assert.deepEqual(JSON.parse(f.data.get(PROGRESSION)!), []);
  assert.ok(f.data.get(INTENT));
});
