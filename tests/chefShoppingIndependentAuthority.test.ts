import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { describeVerifiedChefShoppingList } from "../src/utils/chefWorkspaceFacts";
import {
  selectCompleteChefServerShopping, type ChefServerReadEvidence,
} from "../src/utils/chefServerReadAuthority";

const shopping: ShoppingItem[] = [
  { id: "oil", name: "Olive oil", quantity: 1, unit: "L",
    category: "Other", checked: false, amountOrigin: "ai_estimated",
    purchaseAmountConfirmed: false },
  { id: "eggs", name: "Eggs", quantity: 6, unit: "ud",
    category: "Other", checked: true, purchaseAmountConfirmed: false },
];
const evidence: ChefServerReadEvidence = {
  userId: "owner-1", serialized: JSON.stringify(shopping),
};
const uid = "owner-1";

test("standalone list needs valid shopping rows only, not unrelated meal or progression data", () => {
  const answer = describeVerifiedChefShoppingList(shopping, "es")!;
  assert.match(answer, /Olive oil/);
  assert.match(answer, /1 marcados/);
  assert.doesNotMatch(answer, /Eggs|1 L|6 ud|€|EUR/);
  assert.equal(describeVerifiedChefShoppingList([], "en")!.includes("A check mark does not confirm a purchase"), true);
  assert.equal(describeVerifiedChefShoppingList([shopping[0], shopping[0]], "en"), null);
  assert.equal(describeVerifiedChefShoppingList([{ ...shopping[0], quantity: Infinity }], "en"), null);
  assert.equal(describeVerifiedChefShoppingList([{ ...shopping[0], checked: "maybe" as unknown as boolean }], "en"), null);
});

test("signed-in list authority rejects other account, stale display, or missing evidence", () => {
  assert.deepEqual(selectCompleteChefServerShopping(uid, uid, evidence, shopping), shopping);
  assert.equal(selectCompleteChefServerShopping("other", uid, evidence, shopping), null);
  assert.equal(selectCompleteChefServerShopping(uid, "other", evidence, shopping), null);
  assert.equal(selectCompleteChefServerShopping(uid, uid, undefined, shopping), null);
  assert.equal(selectCompleteChefServerShopping(uid, uid, evidence,
    [{ ...shopping[0], quantity: 2 }, shopping[1]]), null);
  assert.equal(selectCompleteChefServerShopping(uid, uid, evidence, [shopping[0]]), null);
  assert.equal(selectCompleteChefServerShopping(uid, uid,
    { userId: "other", serialized: evidence.serialized }, shopping), null);
});

test("Chef UI and App use shopping-only authoritative callback, not the progression gate", () => {
  const chef = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
  assert.match(chef, /workspaceQuery === "SHOW_SHOPPING_LIST"/);
  assert.match(chef, /const rows = onGetAuthoritativeShopping\(\)/);
  assert.match(chef, /describeVerifiedChefShoppingList\(rows, language\)/);
  assert.match(app, /const getAuthoritativeChefShopping = /);
  assert.match(app, /guestShoppingCacheIsComplete\(raw\)/);
  assert.match(app, /hasPendingGuestMutationJournal\(localStorage\)/);
  assert.match(hook, /getServerConfirmedChefShopping =/);
  assert.match(hook, /selectCompleteChefServerShopping\(/);
});
