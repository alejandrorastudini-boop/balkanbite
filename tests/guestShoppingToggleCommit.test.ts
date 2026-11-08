import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { commitVerifiedGuestShoppingToggle } from "../src/utils/guestShoppingToggleCommit";

const list: ShoppingItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 500, unit: "g",
  category: "Other", checked: false, amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
}];
const makeStorage = () => {
  const values = new Map([["balkanbite_shopping", JSON.stringify(list)]]);
  return {
    values,
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, raw: string) { values.set(key, raw); },
  };
};
test("verified shopping toggle persists exact approved amount before returning success", () => {
  const storage = makeStorage();
  const result = commitVerifiedGuestShoppingToggle(storage, list, "qa-rice");
  assert.equal(result.saved, true);
  if (!result.saved) return;
  assert.equal(result.next[0].checked, true);
  assert.equal(result.next[0].purchaseAmountConfirmed, true);
  assert.equal(JSON.parse(storage.getItem("balkanbite_shopping")!)[0].checked, true);
  assert.equal(list[0].checked, false);
  const back = commitVerifiedGuestShoppingToggle(storage, result.next, "qa-rice");
  assert.equal(back.saved, true);
  if (back.saved) {
    assert.equal(back.next[0].checked, false);
    assert.equal(back.next[0].purchaseAmountConfirmed, false);
  }
});
test("silent/throwing storage errors and failed readback never acknowledge purchase", () => {
  const base = makeStorage();
  const silent = { getItem: base.getItem, setItem(_key: string, _raw: string) {} };
  assert.deepEqual(commitVerifiedGuestShoppingToggle(silent, list, "qa-rice"),
    { saved: false, reason: "storage-unavailable" });
  assert.equal(JSON.parse(base.getItem("balkanbite_shopping")!)[0].checked, false);
  const throwing = { getItem: base.getItem, setItem() { throw new Error("qa quota"); } };
  assert.deepEqual(commitVerifiedGuestShoppingToggle(throwing, list, "qa-rice"),
    { saved: false, reason: "storage-unavailable" });
});
test("stale, invalid, duplicate, missing or journalled source refuses to rewrite original", () => {
  const storage = makeStorage();
  const initial = storage.getItem("balkanbite_shopping");
  assert.equal(commitVerifiedGuestShoppingToggle(storage, [{ ...list[0], checked: true }], "qa-rice").saved, false);
  assert.equal(commitVerifiedGuestShoppingToggle(storage, [list[0], list[0]], "qa-rice").saved, false);
  assert.equal(commitVerifiedGuestShoppingToggle(storage, list, "missing").saved, false);
  storage.values.set("balkanbite_guest_purchase_intent_v1", "pending");
  assert.deepEqual(commitVerifiedGuestShoppingToggle(storage, list, "qa-rice"),
    { saved: false, reason: "journal-pending" });
  storage.values.delete("balkanbite_guest_purchase_intent_v1");
  storage.values.set("balkanbite_shopping", '[{"id":"legacy","unknown":"retain"}]');
  assert.deepEqual(commitVerifiedGuestShoppingToggle(storage, list, "qa-rice"),
    { saved: false, reason: "incomplete" });
  assert.equal(storage.getItem("balkanbite_shopping"), '[{"id":"legacy","unknown":"retain"}]');
  storage.values.set("balkanbite_shopping", initial!);
  assert.equal(commitVerifiedGuestShoppingToggle(storage, list, "qa-rice").saved, true);
});
test("App waits for verified guest toggle before updating React; Auth stays on server mutation", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = app.indexOf("const handleToggleShoppingItem = async");
  const end = app.indexOf("const handleDeleteShoppingItem = async", start);
  const handler = app.slice(start, end);
  assert.match(handler, /commitVerifiedGuestShoppingToggle\(localStorage, shoppingList, id\)/);
  assert.match(handler, /if \(!result\.saved\) \{[\s\S]*?return false;/);
  assert.ok(handler.indexOf("setShoppingList(result.next)") > handler.indexOf("if (!result.saved)"));
  assert.match(handler, /submitShoppingItemReplace\(expected, next\)/);
});
