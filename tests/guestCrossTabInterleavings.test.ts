import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanDay, PantryItem, Recipe, ShoppingItem } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import {
  GUEST_PURCHASE_INTENT_KEY,
  commitConfirmedGuestPurchaseIntent,
  recoverConfirmedGuestPurchaseIntent,
} from "../src/utils/guestConfirmedPurchaseIntent";
import {
  GUEST_VOICE_INTENT_KEY,
  GUEST_VOICE_RECEIPTS_KEY,
  commitGuestVoiceRemoval,
  recoverGuestVoiceRemoval,
  type GuestVoiceCommand,
} from "../src/utils/guestVoiceRemovalIntent";
import { deductVoiceItemsFromPantry } from "../src/utils/pantryConsumption";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "../src/utils/derivedShortageShopping";

const pantry: PantryItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 150, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-16",
}];
const milk: ShoppingItem = {
  id: "qa-milk", name: "QA Milk", quantity: 2, unit: "l",
  category: "Dairy", checked: true, amountOrigin: "user_entered",
  purchaseAmountConfirmed: true,
};
const manual: ShoppingItem = {
  id: "qa-salt", name: "QA Salt", quantity: 1, unit: "kg",
  category: "Other", checked: false, amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};
const shopping: ShoppingItem[] = [milk, manual];
const recipes: Recipe[] = [];
const plan: MealPlanDay[] = [];
const timestamp = "2026-10-16T12:00:00.000Z";
const removed = [{ name: "QA Rice", quantity: 100, unit: "g" }];
const nextPantry = deductVoiceItemsFromPantry(pantry, removed, new Date(timestamp)).pantry;
const nextRecipes = syncRecipesWithPantry(recipes, nextPantry, new Date(timestamp));
const nextShopping = reconcileDerivedShortageShoppingItems(
  shopping, evaluateShoppingNeeds(nextPantry, plan, shopping, "en").itemsToAddToShoppingList,
).next;

function voiceCommand(): GuestVoiceCommand {
  return {
    mutationId: "voice-two-tab-rice", purpose: "food-use", occurredAt: timestamp,
    language: "en", items: removed,
    expectedPantry: pantry, expectedRecipes: recipes,
    expectedPlan: plan, expectedShopping: shopping,
    nextPlan: plan, nextRecipes, nextShopping,
  };
}
function purchaseCommand() {
  return {
    operationId: "purchase-two-tab-milk",
    acquiredAt: "2026-10-16", occurredAt: timestamp,
    expectedPantry: pantry, expectedShopping: shopping, expectedProgression: [],
  };
}

/**
 * Two independent tab adapters share the same localStorage bytes. Hooking a
 * staging write models the other tab winning AFTER the first tab's preflight
 * but BEFORE its marker is visible. This is deterministic scheduling, not a
 * substitute for real Chromium two-tab concurrency or an atomic CAS.
 */
function twoTabs() {
  const data = new Map<string, string>([
    [GUEST_PANTRY_KEY, JSON.stringify(pantry)],
    ["balkanbite_recipes", JSON.stringify(recipes)],
    ["balkanbite_mealplan", JSON.stringify(plan)],
    ["balkanbite_shopping", JSON.stringify(shopping)],
    ["balkanbite_progression", "[]"],
    [GUEST_VOICE_RECEIPTS_KEY, "[]"],
  ]);
  const hooks = new Map<string, { key: string; action: () => void }>();
  const makeTab = (name: string) => ({
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) {
      const hook = hooks.get(name);
      if (hook?.key === key) {
        hooks.delete(name);
        hook.action();
      }
      data.set(key, value);
    },
    removeItem(key: string) { data.delete(key); },
  });
  const a = makeTab("a");
  const b = makeTab("b");
  return {
    data, a, b,
    beforeSet(tab: "a" | "b", key: string, action: () => void) {
      hooks.set(tab, { key, action });
    },
    readPantry: (): PantryItem[] => JSON.parse(data.get(GUEST_PANTRY_KEY)!) as PantryItem[],
    readShopping: (): ShoppingItem[] => JSON.parse(data.get("balkanbite_shopping")!) as ShoppingItem[],
  };
}

test("tab B purchase wins before tab A voice journal staging: voice fails closed without removing purchased stock", () => {
  const tabs = twoTabs();
  let purchaseResult: ReturnType<typeof commitConfirmedGuestPurchaseIntent> | undefined;
  tabs.beforeSet("a", GUEST_VOICE_INTENT_KEY, () => {
    purchaseResult = commitConfirmedGuestPurchaseIntent(tabs.b, purchaseCommand());
  });
  const voiceResult = commitGuestVoiceRemoval(tabs.a, voiceCommand());

  assert.deepEqual(purchaseResult, { status: "saved" });
  assert.deepEqual(voiceResult, { status: "blocked", reason: "pantry-write-failed" });
  assert.equal(tabs.readPantry().find(item => item.id === "qa-rice")?.quantity, 150);
  assert.equal(tabs.readPantry().find(item => item.name === "QA Milk")?.quantity, 2);
  assert.deepEqual(tabs.readShopping(), [manual]);
  assert.equal(JSON.parse(tabs.data.get("balkanbite_progression")!).length, 1);
  assert.deepEqual(JSON.parse(tabs.data.get(GUEST_VOICE_RECEIPTS_KEY)!), []);
  // A staged but stale WAL must remain visible for review, not silently replay.
  assert.ok(tabs.data.has(GUEST_VOICE_INTENT_KEY));
  assert.deepEqual(recoverGuestVoiceRemoval(tabs.b), { status: "blocked", reason: "conflict" });
});

test("tab B voice wins before tab A purchase journal staging: purchase fails closed, no duplicate receipt", () => {
  const tabs = twoTabs();
  let voiceResult: ReturnType<typeof commitGuestVoiceRemoval> | undefined;
  tabs.beforeSet("a", GUEST_PURCHASE_INTENT_KEY, () => {
    voiceResult = commitGuestVoiceRemoval(tabs.b, voiceCommand());
  });
  const purchaseResult = commitConfirmedGuestPurchaseIntent(tabs.a, purchaseCommand());

  assert.deepEqual(voiceResult, { status: "saved" });
  assert.deepEqual(purchaseResult, { status: "blocked", reason: "conflict" });
  assert.equal(tabs.readPantry().find(item => item.id === "qa-rice")?.quantity, 50);
  assert.equal(tabs.readPantry().some(item => item.name === "QA Milk"), false);
  assert.deepEqual(tabs.readShopping(), shopping);
  assert.equal(JSON.parse(tabs.data.get(GUEST_VOICE_RECEIPTS_KEY)!).length, 1);
  assert.deepEqual(JSON.parse(tabs.data.get("balkanbite_progression")!), []);
  assert.ok(tabs.data.has(GUEST_PURCHASE_INTENT_KEY));
  assert.deepEqual(recoverConfirmedGuestPurchaseIntent(tabs.b), { status: "blocked", reason: "conflict" });
});

test("a pending voice journal blocks a second tab purchase rather than guessing completion", () => {
  const tabs = twoTabs();
  tabs.data.set(GUEST_VOICE_INTENT_KEY, "{incomplete-or-corrupt");
  assert.deepEqual(commitConfirmedGuestPurchaseIntent(tabs.b, purchaseCommand()), {
    status: "blocked", reason: "unresolved-intent",
  });
  assert.equal(tabs.readPantry()[0].quantity, 150);
  assert.deepEqual(tabs.readShopping(), shopping);
  assert.equal(tabs.data.get(GUEST_VOICE_INTENT_KEY), "{incomplete-or-corrupt");
});
