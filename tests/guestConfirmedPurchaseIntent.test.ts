import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, ShoppingItem } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import { GUEST_PANTRY_SHOPPING_JOURNAL_KEY } from "../src/utils/guestPantryShoppingJournal";
import {
  GUEST_PURCHASE_INTENT_KEY as INTENT,
  commitConfirmedGuestPurchaseIntent,
  recoverConfirmedGuestPurchaseIntent,
} from "../src/utils/guestConfirmedPurchaseIntent";

const SHOPPING = "balkanbite_shopping";
const PROGRESS = "balkanbite_progression";
const RECIPES = "balkanbite_recipes";
const PLAN = "balkanbite_mealplan";
const purchased: ShoppingItem = {
  id: "qa-milk", name: "QA milk", quantity: 2, unit: "l",
  category: "Dairy", checked: true, amountOrigin: "user_entered",
  purchaseAmountConfirmed: true,
};
const manual: ShoppingItem = {
  id: "qa-eggs", name: "QA eggs", quantity: 2, unit: "ud",
  category: "Other", checked: false, amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};
const pantry: PantryItem[] = [];
const shopping = [purchased, manual];
const command = () => ({
  operationId: "qa-purchase-20261016",
  occurredAt: "2026-10-16T09:00:00.000Z",
  acquiredAt: "2026-10-16",
  expectedPantry: pantry,
  expectedShopping: shopping,
  expectedProgression: [],
});
type Failure = "throw" | "silent";
function fixture() {
  const data = new Map([
    [GUEST_PANTRY_KEY, JSON.stringify(pantry)],
    [SHOPPING, JSON.stringify(shopping)],
    [PROGRESS, "[]"],
    [RECIPES, "[]"],
    [PLAN, "[]"],
  ]);
  const faults = new Map<string, Failure>();
  let primaryWrites = 0;
  let shoppingWrites = 0;
  let progressWrites = 0;
  let skipRemoval = false;
  const storage = {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) {
      if (faults.get(key) === "throw") throw new Error("simulated quota");
      if (faults.get(key) === "silent") return;
      if (key === GUEST_PANTRY_KEY) primaryWrites++;
      if (key === SHOPPING) shoppingWrites++;
      if (key === PROGRESS) progressWrites++;
      data.set(key, value);
    },
    removeItem(key: string) { if (!skipRemoval) data.delete(key); },
  };
  return {
    data, faults, storage,
    get primaryWrites() { return primaryWrites; },
    get shoppingWrites() { return shoppingWrites; },
    get progressWrites() { return progressWrites; },
    skipRemoval: (enabled: boolean) => { skipRemoval = enabled; },
  };
}

test("confirmed guest purchase stages first and commits pantry, shopping, progression exactly once", () => {
  const a = fixture();
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), { status: "saved" });
  const items = JSON.parse(a.data.get(GUEST_PANTRY_KEY)!);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "QA milk");
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].unit, "l");
  assert.equal(items[0].purchaseHistory[0].sourceId, "shopping:qa-milk");
  assert.deepEqual(JSON.parse(a.data.get(SHOPPING)!), [manual]);
  const progress = JSON.parse(a.data.get(PROGRESS)!);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].eventId, "purchase:shopping:qa-milk");
  assert.equal(progress[0].type, "confirmed_purchase_applied");
  assert.equal(a.data.get(INTENT), undefined);
  assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "none" });
});

test("missing or unconfirmed purchases do not stage journal or invent acquisitions", () => {
  for (const list of [
    [manual], [{ ...purchased, purchaseAmountConfirmed: false }, manual],
    [{ ...purchased, quantity: NaN }, manual],
  ]) {
    const a = fixture();
    a.data.set(SHOPPING, JSON.stringify(list));
    const actual = commitConfirmedGuestPurchaseIntent(a.storage, {
      ...command(), expectedShopping: list,
    });
    assert.equal(actual.status, "blocked");
    assert.equal(a.data.get(INTENT), undefined);
    assert.equal(a.primaryWrites, 0);
  }
});

test("historical invalid cache or missing source blocks without deleting original bytes", () => {
  for (const key of [GUEST_PANTRY_KEY, SHOPPING, PROGRESS, RECIPES, PLAN]) {
    const a = fixture();
    a.data.set(key, "{original-corrupt");
    assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), {
      status: "blocked", reason: key === GUEST_PANTRY_KEY || key === SHOPPING ||
      key === PROGRESS ? "stale-snapshot" : "invalid-source",
    });
    assert.equal(a.data.get(key), "{original-corrupt");
    assert.equal(a.data.get(INTENT), undefined);
    assert.equal(a.primaryWrites, 0);
  }
  const b = fixture();
  b.data.delete(PROGRESS);
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(b.storage, command()), {
    status: "blocked", reason: "invalid-source",
  });
});

test("stale React snapshot cannot commit over another tab", () => {
  const a = fixture();
  a.data.set(SHOPPING, JSON.stringify([{ ...purchased, quantity: 3 }, manual]));
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), {
    status: "blocked", reason: "stale-snapshot",
  });
  assert.equal(a.data.get(INTENT), undefined);
  assert.equal(a.primaryWrites, 0);
});

test("silent or thrown intent staging is rejected before any purchase", () => {
  for (const failure of ["silent", "throw"] as const) {
    const a = fixture();
    a.faults.set(INTENT, failure);
    assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), {
      status: "blocked", reason: "storage-unavailable",
    });
    assert.equal(a.primaryWrites, 0);
    assert.equal(a.shoppingWrites, 0);
    assert.equal(a.progressWrites, 0);
    assert.deepEqual(JSON.parse(a.data.get(SHOPPING)!), shopping);
  }
});

test("pantry write failure produces an unapplied intent; recovery never executes a purchase", () => {
  for (const failure of ["silent", "throw"] as const) {
    const a = fixture();
    a.faults.set(GUEST_PANTRY_KEY, failure);
    assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
    assert.ok(a.data.get(INTENT));
    assert.equal(a.primaryWrites, 0);
    a.faults.clear();
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "unapplied" });
    assert.equal(a.primaryWrites, 0);
    assert.equal(a.progressWrites, 0);
    assert.equal(a.data.get(INTENT), undefined);
  }
});

test("after a shopping write fault, reload recovery completes shopping and progression, never pantry again", () => {
  for (const failure of ["silent", "throw"] as const) {
    const a = fixture();
    a.faults.set(SHOPPING, failure);
    assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
    assert.equal(a.primaryWrites, 1);
    assert.ok(a.data.get(INTENT));
    assert.deepEqual(JSON.parse(a.data.get(SHOPPING)!), shopping);
    a.faults.clear();
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "completed-derived-writes" });
    assert.deepEqual(JSON.parse(a.data.get(SHOPPING)!), [manual]);
    assert.equal(JSON.parse(a.data.get(PROGRESS)!).length, 1);
    assert.equal(a.primaryWrites, 1);
    assert.equal(a.shoppingWrites, 1);
    assert.equal(a.progressWrites, 1);
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "none" });
  }
});

test("after progression write fault, recovery restores exactly one event without extra stock", () => {
  for (const failure of ["silent", "throw"] as const) {
    const a = fixture();
    a.faults.set(PROGRESS, failure);
    assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
    assert.deepEqual(JSON.parse(a.data.get(SHOPPING)!), [manual]);
    assert.deepEqual(JSON.parse(a.data.get(PROGRESS)!), []);
    assert.equal(a.primaryWrites, 1);
    a.faults.clear();
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "completed-derived-writes" });
    assert.equal(a.primaryWrites, 1);
    assert.equal(a.shoppingWrites, 1);
    assert.equal(a.progressWrites, 1);
    assert.equal(JSON.parse(a.data.get(PROGRESS)!).length, 1);
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "none" });
  }
});

test("cleanup failure retains marker and recovery never rewrites all-success purchase", () => {
  const a = fixture();
  a.skipRemoval(true);
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), {
    status: "saved-pending-cleanup",
  });
  assert.ok(a.data.get(INTENT));
  a.skipRemoval(false);
  assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), { status: "already-complete" });
  assert.equal(a.primaryWrites, 1);
  assert.equal(a.shoppingWrites, 1);
  assert.equal(a.progressWrites, 1);
  assert.equal(a.data.get(INTENT), undefined);
});

test("unresolved purchase intent and unresolved quantity WAL both block new purchases", () => {
  const a = fixture();
  a.faults.set(SHOPPING, "silent");
  assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
  a.faults.clear();
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(a.storage, command()), {
    status: "blocked", reason: "unresolved-intent",
  });
  const b = fixture();
  b.data.set(GUEST_PANTRY_SHOPPING_JOURNAL_KEY, "historical pending");
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(b.storage, command()), {
    status: "blocked", reason: "unresolved-intent",
  });
});

test("changed plan, unrelated shopping, or progression during recovery stays untouched", () => {
  for (const key of [SHOPPING, PROGRESS, PLAN, RECIPES, GUEST_PANTRY_KEY]) {
    const a = fixture();
    a.faults.set(SHOPPING, "silent");
    assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
    a.faults.clear();
    const externalValue = key === GUEST_PANTRY_KEY ? "[]" : key === PROGRESS
      ? JSON.stringify([{ version: 1, eventId: "cook:other", type: "recipe_cook_inventory_applied",
        occurredAt: "2026-10-16T09:00:00Z", evidence: "deterministic_state_transition", evidenceCount: 1 }])
      : key === SHOPPING ? JSON.stringify([manual])
      : "[{\"date\":\"2026-10-17\"}]";
    a.data.set(key, externalValue);
    const before = a.data.get(key);
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), {
      status: "blocked", reason: "conflict",
    });
    assert.equal(a.data.get(key), before);
    assert.ok(a.data.get(INTENT), "conflicts retain original recovery evidence");
    assert.equal(a.primaryWrites, 1);
  }
});

test("malformed, tampered, or future intent never overwrites user data", () => {
  for (const raw of ["not-json", '{"version":2}', '{"version":1}']) {
    const a = fixture();
    a.data.set(INTENT, raw);
    assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), {
      status: "blocked", reason: "invalid-intent",
    });
    assert.equal(a.data.get(INTENT), raw);
    assert.equal(a.primaryWrites, 0);
  }
  const b = fixture();
  b.faults.set(SHOPPING, "silent");
  assert.equal(commitConfirmedGuestPurchaseIntent(b.storage, command()).status, "blocked");
  b.faults.clear();
  const intent = JSON.parse(b.data.get(INTENT)!);
  intent.progressionAfter = JSON.stringify([]);
  b.data.set(INTENT, JSON.stringify(intent));
  assert.deepEqual(recoverConfirmedGuestPurchaseIntent(b.storage), {
    status: "blocked", reason: "invalid-intent",
  });
  assert.equal(b.primaryWrites, 1);
  assert.equal(b.progressWrites, 0);
});

test("recovery with silent shopping failure does not declare success", () => {
  const a = fixture();
  a.faults.set(SHOPPING, "throw");
  assert.equal(commitConfirmedGuestPurchaseIntent(a.storage, command()).status, "blocked");
  a.faults.set(SHOPPING, "silent");
  assert.deepEqual(recoverConfirmedGuestPurchaseIntent(a.storage), {
    status: "blocked", reason: "storage-unavailable",
  });
  assert.ok(a.data.get(INTENT));
  assert.equal(a.progressWrites, 0);
  assert.equal(a.primaryWrites, 1);
});
