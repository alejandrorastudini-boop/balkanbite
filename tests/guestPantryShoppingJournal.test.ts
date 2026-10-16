import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, ShoppingItem } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import { SAMPLE_RECIPES } from "../src/data/initialData";
import {
  GUEST_PANTRY_SHOPPING_JOURNAL_KEY as JOURNAL,
  recoverGuestPantryShoppingJournal,
  writeGuestPantryShoppingWithJournal,
  writeGuestPantryWithDerivedShoppingJournal,
  type GuestJournalStorage,
} from "../src/utils/guestPantryShoppingJournal";

const SHOPPING = "balkanbite_shopping";
const PLAN = "balkanbite_mealplan";
const rice: PantryItem = {
  id: "qa-rice", name: "QA rice", quantity: 500, unit: "g",
  category: "Pantry/Grains", addedAt: "fixture",
};
const afterRice: PantryItem = { ...rice, quantity: 400 };
const manual: ShoppingItem = {
  id: "qa-manual", name: "QA user-entered", quantity: 2, unit: "ud",
  category: "Other", checked: false, amountOrigin: "user_entered",
  purchaseAmountConfirmed: false, reason: "Keep exact manual record",
};
const newShortage: ShoppingItem = {
  id: "shortage-v1:qa-food", name: "QA rice", quantity: 100, unit: "g",
  category: "Other", checked: false,
  amountOrigin: "deterministic_shortfall",
  purchaseAmountConfirmed: false,
};

type FailureMode = "silent" | "throw";
function fixture(options?: { pantryRaw?: string; shoppingRaw?: string; planRaw?: string }) {
  const raw = new Map<string, string>([
    [GUEST_PANTRY_KEY, options?.pantryRaw ?? JSON.stringify([rice])],
    [SHOPPING, options?.shoppingRaw ?? JSON.stringify([manual])],
    [PLAN, options?.planRaw ?? "[]"],
  ]);
  const faults = new Map<string, FailureMode>();
  let ignoredRemoved = false;
  let primaryWrites = 0;
  let shoppingWrites = 0;
  const storage: GuestJournalStorage = {
    getItem(key) { return raw.get(key) ?? null; },
    setItem(key, value) {
      const failure = faults.get(key);
      if (failure === "throw") throw new Error("simulated quota");
      if (failure === "silent") return;
      if (key === GUEST_PANTRY_KEY) primaryWrites++;
      if (key === SHOPPING) shoppingWrites++;
      raw.set(key, value);
    },
    removeItem(key) {
      if (ignoredRemoved) return;
      raw.delete(key);
    },
  };
  return {
    raw, faults, storage,
    get primaryWrites() { return primaryWrites; },
    get shoppingWrites() { return shoppingWrites; },
    skipRemove(enabled: boolean) { ignoredRemoved = enabled; },
  };
}
const next = () => ({
  operationId: "qa-confirmed-stock-change-001",
  expectedPantry: [rice],
  nextPantry: [afterRice],
  expectedShopping: [manual],
  nextShopping: [manual, newShortage],
  expectedMealPlanRaw: "[]",
});

test("two-key WAL stages, persists pantry and shopping, then clears only its marker", () => {
  const state = fixture();
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), { status: "saved" });
  assert.equal(state.raw.get(JOURNAL), undefined);
  assert.deepEqual(JSON.parse(state.raw.get(GUEST_PANTRY_KEY)!), [afterRice]);
  assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual, newShortage]);
  assert.equal(state.primaryWrites, 1);
  assert.equal(state.shoppingWrites, 1);
  assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), { status: "none" });
});

test("WAL quota and silent marker rejection happen BEFORE writing authoritative stock", () => {
  for (const mode of ["throw", "silent"] as const) {
    const state = fixture();
    const pantryBefore = state.raw.get(GUEST_PANTRY_KEY);
    const shoppingBefore = state.raw.get(SHOPPING);
    state.faults.set(JOURNAL, mode);
    assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), {
      status: "blocked", reason: "storage-unavailable",
    });
    assert.equal(state.raw.get(GUEST_PANTRY_KEY), pantryBefore);
    assert.equal(state.raw.get(SHOPPING), shoppingBefore);
    assert.equal(state.primaryWrites, 0);
    assert.equal(state.shoppingWrites, 0);
  }
});

test("a journal written before a failed pantry mutation is never replayed as a stock purchase", () => {
  for (const mode of ["throw", "silent"] as const) {
    const state = fixture();
    const oldStock = state.raw.get(GUEST_PANTRY_KEY);
    state.faults.set(GUEST_PANTRY_KEY, mode);
    const result = writeGuestPantryShoppingWithJournal(state.storage, next());
    assert.equal(result.status, "blocked");
    assert.equal(state.raw.get(GUEST_PANTRY_KEY), oldStock);
    assert.ok(state.raw.get(JOURNAL));
    state.faults.clear();
    assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
      status: "unapplied",
    });
    assert.equal(state.primaryWrites, 0, "recovery may NEVER apply pantry mutation");
    assert.equal(state.shoppingWrites, 0);
    assert.equal(state.raw.get(JOURNAL), undefined);
    assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual]);
  }
});

test("shopping quota or silent failure after confirmed pantry is replayed once without stock mutation", () => {
  for (const mode of ["throw", "silent"] as const) {
    const state = fixture();
    state.faults.set(SHOPPING, mode);
    const result = writeGuestPantryShoppingWithJournal(state.storage, next());
    assert.equal(result.status, "blocked");
    assert.deepEqual(JSON.parse(state.raw.get(GUEST_PANTRY_KEY)!), [afterRice]);
    assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual]);
    assert.ok(state.raw.get(JOURNAL), "original WAL must survive partial write");
    assert.equal(state.primaryWrites, 1);
    state.faults.clear();
    assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
      status: "shopping-replayed",
    });
    assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual, newShortage]);
    assert.equal(state.primaryWrites, 1, "never recalculate/add/deduct pantry again");
    assert.equal(state.shoppingWrites, 1);
    assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), { status: "none" });
    assert.equal(state.shoppingWrites, 1, "recovery must be idempotent");
  }
});

test("a failed WAL cleanup is independently recoverable with no repeated business operation", () => {
  const state = fixture();
  state.skipRemove(true);
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), {
    status: "saved-pending-cleanup",
  });
  assert.ok(state.raw.get(JOURNAL));
  const writes = state.primaryWrites;
  const shoppingWrites = state.shoppingWrites;
  state.skipRemove(false);
  assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
    status: "already-complete",
  });
  assert.equal(state.primaryWrites, writes);
  assert.equal(state.shoppingWrites, shoppingWrites);
  assert.equal(state.raw.get(JOURNAL), undefined);
});

test("unresolved old intent blocks a new mutation without overwriting previous data", () => {
  const state = fixture();
  state.faults.set(SHOPPING, "throw");
  assert.equal(writeGuestPantryShoppingWithJournal(state.storage, next()).status, "blocked");
  state.faults.clear();
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, {
    ...next(), operationId: "another-guest-command",
  }), { status: "blocked", reason: "unresolved-journal" });
  assert.equal(state.primaryWrites, 1);
});

test("a changed plan or concurrent shopping edit conflicts instead of being overwritten on recovery", () => {
  for (const key of [PLAN, SHOPPING, GUEST_PANTRY_KEY]) {
    const state = fixture();
    state.faults.set(SHOPPING, "silent");
    assert.equal(writeGuestPantryShoppingWithJournal(state.storage, next()).status, "blocked");
    state.faults.clear();
    const distinct = key === GUEST_PANTRY_KEY
      ? JSON.stringify([{ ...rice, quantity: 800 }])
      : key === PLAN
        ? JSON.stringify([{ date: "2026-10-16" }])
        : JSON.stringify([manual, { ...newShortage, id: "qa-concurrent-manual", amountOrigin: "user_entered" }]);
    state.raw.set(key, distinct);
    assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
      status: "blocked", reason: "conflict",
    });
    assert.equal(state.raw.get(key), distinct);
    assert.ok(state.raw.get(JOURNAL), "preserve evidence on conflicts");
    assert.equal(state.primaryWrites, 1);
  }
});

test("invalid or incomplete guest/plan/shopping snapshots cannot stage WAL", () => {
  for (const options of [
    { pantryRaw: JSON.stringify([{ id: "not-a-food" }]) },
    { shoppingRaw: JSON.stringify([manual, { id: "partial" }]) },
    { planRaw: JSON.stringify([{ date: "bad" }]) },
  ]) {
    const state = fixture(options);
    assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), {
      status: "blocked", reason: "invalid-input",
    });
    assert.equal(state.raw.get(JOURNAL), undefined);
    assert.equal(state.primaryWrites, 0);
  }
  const state = fixture();
  state.raw.delete(SHOPPING);
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), {
    status: "blocked", reason: "invalid-input",
  });
});

test("invalid next items and changes to manual shopping cannot stage WAL", () => {
  const state = fixture();
  const invalidCases = [
    { ...next(), operationId: "../not-safe" },
    { ...next(), nextPantry: [{ ...afterRice, quantity: Number.NaN }] },
    { ...next(), nextShopping: [{ ...manual, quantity: 1000 }, newShortage] },
    { ...next(), nextShopping: [manual, manual] },
    { ...next(), nextPantry: [rice] },
  ];
  for (const entry of invalidCases) {
    assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, entry), {
      status: "blocked", reason: "invalid-input",
    });
    assert.equal(state.raw.get(JOURNAL), undefined);
  }
});

test("stale pantry or shopping snapshot rejects before creating a journal", () => {
  const state = fixture();
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, {
    ...next(), expectedPantry: [{ ...rice, quantity: 999 }],
  }), { status: "blocked", reason: "stale-snapshot" });
  const staleManual = { ...manual, quantity: 999 };
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, {
    ...next(), expectedShopping: [staleManual],
    nextShopping: [staleManual, newShortage],
  }), { status: "blocked", reason: "stale-snapshot" });
  assert.equal(state.raw.get(JOURNAL), undefined);
});

test("malformed or future-version journals remain untouched and cannot write pantry/shopping", () => {
  for (const content of ["not-json", JSON.stringify({ version: 99 }),
    JSON.stringify({ version: 1, operationId: "incomplete" })]) {
    const state = fixture();
    state.raw.set(JOURNAL, content);
    assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
      status: "blocked", reason: "invalid-journal",
    });
    assert.equal(state.raw.get(JOURNAL), content);
    assert.equal(state.primaryWrites, 0);
    assert.equal(state.shoppingWrites, 0);
  }
});

test("recovery refuses a journal that removes user-entered purchases", () => {
  const state = fixture();
  state.faults.set(SHOPPING, "throw");
  assert.equal(writeGuestPantryShoppingWithJournal(state.storage, next()).status, "blocked");
  const raw = JSON.parse(state.raw.get(JOURNAL)!);
  raw.shoppingAfter = JSON.stringify([newShortage]);
  const malformed = JSON.stringify(raw);
  state.raw.set(JOURNAL, malformed);
  state.faults.clear();
  assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
    status: "blocked", reason: "invalid-journal",
  });
  assert.equal(state.raw.get(JOURNAL), malformed);
  assert.equal(state.shoppingWrites, 0);
  assert.equal(state.primaryWrites, 1);
});

test("silent shopping writes during recovery preserve WAL and do not claim repaired", () => {
  const state = fixture();
  state.faults.set(SHOPPING, "throw");
  assert.equal(writeGuestPantryShoppingWithJournal(state.storage, next()).status, "blocked");
  state.faults.set(SHOPPING, "silent");
  assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
    status: "blocked", reason: "storage-unavailable",
  });
  assert.ok(state.raw.get(JOURNAL));
  assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual]);
});

test("derived journal computes a new shortfall only from stored valid menu facts", () => {
  const now = new Date(2026, 9, 16, 12, 0, 0);
  const plan = JSON.stringify([{ date: "2026-10-16", lunch: SAMPLE_RECIPES[1] }]);
  const state = fixture({ planRaw: plan });
  assert.deepEqual(writeGuestPantryWithDerivedShoppingJournal(state.storage, {
    operationId: "qa-derived-shortfall",
    expectedPantry: [rice],
    nextPantry: [afterRice],
    language: "es",
    now,
  }), { status: "saved" });
  const rows = JSON.parse(state.raw.get(SHOPPING)!) as ShoppingItem[];
  assert.deepEqual(rows[0], manual, "manual shopping row remains identical");
  const lentils = rows.find(row => row.name === "Lentejas");
  assert.ok(lentils, "only existing stored menu ingredients can generate needs");
  assert.equal(lentils.amountOrigin, "deterministic_shortfall");
  assert.equal(lentils.purchaseAmountConfirmed, false);
  assert.equal(lentils.estimatedPriceEUR, undefined,
    "unverified market prices must not be generated");
  assert.equal(state.raw.get(JOURNAL), undefined);
});

test("high-level derived WAL blocks when the validated plan changes during staging", () => {
  const plan = JSON.stringify([{ date: "2026-10-16", lunch: SAMPLE_RECIPES[1] }]);
  const state = fixture({ planRaw: plan });
  let reads = 0;
  const raced: GuestJournalStorage = {
    ...state.storage,
    getItem(key) {
      if (key === PLAN) {
        reads++;
        if (reads === 2) state.raw.set(PLAN, "[]");
      }
      return state.storage.getItem(key);
    },
  };
  assert.deepEqual(writeGuestPantryWithDerivedShoppingJournal(raced, {
    operationId: "qa-stale-plan",
    expectedPantry: [rice], nextPantry: [afterRice],
    language: "en", now: new Date(2026, 9, 16, 12),
  }), { status: "blocked", reason: "stale-snapshot" });
  assert.equal(state.primaryWrites, 0);
  assert.equal(state.shoppingWrites, 0);
  assert.equal(state.raw.get(JOURNAL), undefined);
});

test("high-level derived WAL does not infer a shopping list from missing caches", () => {
  const state = fixture();
  state.raw.delete(PLAN);
  assert.deepEqual(writeGuestPantryWithDerivedShoppingJournal(state.storage, {
    operationId: "qa-no-stored-plan", expectedPantry: [rice],
    nextPantry: [afterRice], language: "bg",
  }), { status: "blocked", reason: "invalid-input" });
  assert.equal(state.primaryWrites, 0);
});

test("low-level journal blocks if persisted plan diverges from the caller baseline", () => {
  const state = fixture();
  assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, {
    ...next(), expectedMealPlanRaw: JSON.stringify([{ date: "2026-10-16" }]),
  }), { status: "blocked", reason: "stale-snapshot" });
  assert.equal(state.raw.get(JOURNAL), undefined);
  assert.equal(state.primaryWrites, 0);
});

test("pantry/shopping WAL refuses purchase or cook WAL markers before touching inventory", () => {
  for (const marker of [
    "balkanbite_guest_purchase_intent_v1",
    "balkanbite_guest_cook_intent_v1",
    "balkanbite_guest_cook_derived_intent_v1",
  ]) {
    const state = fixture();
    state.raw.set(marker, "unfinished-other-operation");
    assert.deepEqual(writeGuestPantryShoppingWithJournal(state.storage, next()), {
      status: "blocked", reason: "unresolved-journal",
    });
    assert.equal(state.primaryWrites, 0);
    assert.equal(state.shoppingWrites, 0);
    assert.equal(state.raw.get(JOURNAL), undefined);
  }
});

test("pantry/shopping recovery never overwrites concurrently pending cook or purchase", () => {
  const state = fixture();
  state.faults.set(SHOPPING, "silent");
  assert.equal(writeGuestPantryShoppingWithJournal(state.storage, next()).status, "blocked");
  state.faults.clear();
  state.raw.set("balkanbite_guest_cook_derived_intent_v1", "other-pending");
  assert.deepEqual(recoverGuestPantryShoppingJournal(state.storage), {
    status: "blocked", reason: "conflict",
  });
  assert.deepEqual(JSON.parse(state.raw.get(SHOPPING)!), [manual]);
  assert.ok(state.raw.get(JOURNAL));
});
