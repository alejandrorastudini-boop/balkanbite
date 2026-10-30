import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { commitVerifiedGuestShoppingDelete } from "../src/utils/guestShoppingDeleteCommit";

const manual: ShoppingItem = {
  id: "qa-manual", name: "QA Salt", quantity: 1, unit: "ud",
  category: "Other", checked: false, amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};
const second: ShoppingItem = {
  id: "qa-pending", name: "QA Rice", quantity: 100, unit: "g",
  category: "Other", checked: true, amountOrigin: "user_entered",
  purchaseAmountConfirmed: true,
};
const rows = [manual, second];
const storage = () => {
  const data = new Map<string, string>([["balkanbite_shopping", JSON.stringify(rows)]]);
  return {
    data,
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, raw: string) { data.set(key, raw); },
  };
};

test("deletion preserves the other row exactly and confirms source before publishing", () => {
  const s = storage();
  const done = commitVerifiedGuestShoppingDelete(s, rows, "qa-manual");
  assert.equal(done.saved, true);
  if (!done.saved) return;
  assert.deepEqual(done.next, [second]);
  assert.deepEqual(JSON.parse(s.getItem("balkanbite_shopping")!), [second]);
  assert.deepEqual(rows, [manual, second], "original UI snapshot is not mutated");
});

test("silent and throwing storage failures cannot acknowledge removal", () => {
  const s = storage(), before = s.getItem("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingDelete({
    getItem: s.getItem, setItem() {}, 
  }, rows, "qa-manual"), { saved: false, reason: "storage-unavailable" });
  assert.deepEqual(commitVerifiedGuestShoppingDelete({
    getItem: s.getItem, setItem() { throw Error("quota"); }, 
  }, rows, "qa-manual"), { saved: false, reason: "storage-unavailable" });
  assert.equal(s.getItem("balkanbite_shopping"), before);
});

test("stale, duplicate, malformed or journalled list is never rewritten", () => {
  const s = storage();
  assert.equal(commitVerifiedGuestShoppingDelete(s, [manual], "qa-manual").saved, false);
  assert.equal(commitVerifiedGuestShoppingDelete(s, [manual, manual], "qa-manual").saved, false);
  assert.deepEqual(commitVerifiedGuestShoppingDelete(s, rows, "missing"),
    { saved: false, reason: "missing-row" });
  s.data.set("balkanbite_guest_cook_intent_v1", "unfinished");
  assert.deepEqual(commitVerifiedGuestShoppingDelete(s, rows, "qa-manual"),
    { saved: false, reason: "journal-pending" });
  s.data.delete("balkanbite_guest_cook_intent_v1");
  const unknown = '[{"id":"legacy","note":"unknown original data"}]';
  s.data.set("balkanbite_shopping", unknown);
  assert.deepEqual(commitVerifiedGuestShoppingDelete(s, rows, "qa-manual"),
    { saved: false, reason: "incomplete" });
  assert.equal(s.getItem("balkanbite_shopping"), unknown);
  s.data.set("balkanbite_shopping", JSON.stringify(rows));
  assert.equal(commitVerifiedGuestShoppingDelete(s, rows, "qa-manual").saved, true);
});

test("guest UI only updates after full storage commit; signed-in uses owner mutation", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = app.indexOf("const handleDeleteShoppingItem = async");
  const end = app.indexOf("const handleAddShoppingItem = async", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.match(handler, /commitVerifiedGuestShoppingDelete\(localStorage, shoppingList, id\)/);
  assert.match(handler, /if \(!result\.saved\) \{[\s\S]*?return false;/);
  assert.ok(handler.indexOf("setShoppingList(result.next)") > handler.indexOf("if (!result.saved)"));
  assert.match(handler, /submitShoppingItemRemove\(expected\)/);
  assert.doesNotMatch(handler, /setShoppingList\(prev => prev\.filter/);
});
