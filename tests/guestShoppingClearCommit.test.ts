import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { commitVerifiedGuestShoppingClear } from "../src/utils/guestShoppingDeleteCommit";

const shopping: ShoppingItem[] = [
  { id:"qa-salt", name:"QA Salt", quantity:1, unit:"uds",
    category:"Other", checked:false, amountOrigin:"user_entered",
    purchaseAmountConfirmed:false },
  { id:"qa-rice", name:"QA Rice", quantity:200, unit:"g",
    category:"Other", checked:true, amountOrigin:"user_entered",
    purchaseAmountConfirmed:true },
];
const store = () => {
  const memory = new Map<string,string>([["balkanbite_shopping", JSON.stringify(shopping)]]);
  return {
    memory,
    getItem(key:string) {return memory.get(key) ?? null;},
    setItem(key:string, value:string) {memory.set(key,value);},
  };
};
test("verified clear removes all rows in one write, after exact readback only", () => {
  const s=store();const result=commitVerifiedGuestShoppingClear(s,shopping);
  assert.deepEqual(result,{saved:true,next:[]});
  assert.equal(s.getItem("balkanbite_shopping"), "[]");
  assert.equal(shopping.length,2);
  assert.deepEqual(commitVerifiedGuestShoppingClear(s,[]),{saved:true,next:[]});
});
test("silent or thrown storage failures preserve list and deny successful clear", () => {
  const s=store(),before=s.getItem("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingClear({getItem:s.getItem,setItem(){}},shopping),
    {saved:false,reason:"storage-unavailable"});
  assert.deepEqual(commitVerifiedGuestShoppingClear({getItem:s.getItem,setItem(){throw Error("quota");}},shopping),
    {saved:false,reason:"storage-unavailable"});
  assert.equal(s.getItem("balkanbite_shopping"),before);
});
test("cannot clear stale, duplicate, unknown or journalled guest shopping state", () => {
  const s=store();
  assert.equal(commitVerifiedGuestShoppingClear(s,[shopping[0]]).saved,false);
  assert.equal(commitVerifiedGuestShoppingClear(s,[shopping[0],shopping[0]]).saved,false);
  s.memory.set("balkanbite_guest_cook_intent_v1","pending");
  assert.deepEqual(commitVerifiedGuestShoppingClear(s,shopping),
    {saved:false,reason:"journal-pending"});
  s.memory.delete("balkanbite_guest_cook_intent_v1");
  const unknown='[{"id":"legacy","note":"original user data"}]';
  s.memory.set("balkanbite_shopping",unknown);
  assert.deepEqual(commitVerifiedGuestShoppingClear(s,shopping),
    {saved:false,reason:"incomplete"});
  assert.equal(s.getItem("balkanbite_shopping"),unknown);
  s.memory.delete("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingClear(s,[]),{saved:true,next:[]});
  assert.equal(s.getItem("balkanbite_shopping"),null);
});
test("App guest clear commits before React, signed-in branch stays server-side", () => {
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const start=app.indexOf("const handleClearShoppingList = async"),end=app.indexOf("const tryJournalGuestCheckedTransfer =",start);
  assert.ok(start>0 && end>start);
  const body=app.slice(start,end);
  assert.match(body,/commitVerifiedGuestShoppingClear\(localStorage, shoppingList\)/);
  assert.match(body,/if \(!result\.saved\) \{[\s\S]*?return false;/);
  assert.ok(body.indexOf("setShoppingList(result.next)")>body.indexOf("if (!result.saved)"));
  assert.match(body,/submitShoppingItemsClear\(shoppingList\)/);
  assert.doesNotMatch(body,/setShoppingList\(\[\]\);/);
});
