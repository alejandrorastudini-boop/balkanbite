import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { commitVerifiedGuestShoppingAdd } from "../src/utils/guestShoppingAddCommit";
const old: ShoppingItem = {id:"qa-existing",name:"Existing rice",quantity:100,unit:"g",
  category:"",checked:false,amountOrigin:"user_entered",purchaseAmountConfirmed:false};
const fresh: ShoppingItem = {id:"qa-new",name:"QA Lentils",quantity:500,unit:"g",
  category:"",checked:false,amountOrigin:"user_entered",purchaseAmountConfirmed:false};
const storage = (rows: ShoppingItem[] | null = [old]) => {
  const data = new Map<string,string>();
  if(rows) data.set("balkanbite_shopping", JSON.stringify(rows));
  return { data, getItem(key:string){return data.get(key)??null;},
    setItem(key:string,val:string){data.set(key,val);} };
};
test("guest manual shopping add commits complete list with exact readback before success",()=>{
  const s=storage();const result=commitVerifiedGuestShoppingAdd(s,[old],fresh);
  assert.equal(result.saved,true);
  if(!result.saved)return;
  assert.deepEqual(result.next,[old,fresh]);
  assert.deepEqual(JSON.parse(s.getItem("balkanbite_shopping")!),[old,fresh]);
  assert.equal(old.checked,false);assert.equal(fresh.purchaseAmountConfirmed,false);
  const empty=storage(null);
  assert.deepEqual(commitVerifiedGuestShoppingAdd(empty,[],fresh),
    {saved:true,next:[fresh]});
});
test("lost, thrown, stale and corrupted shopping sources fail without rewriting",()=>{
  const s=storage(),raw=s.getItem("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingAdd({getItem:s.getItem,setItem(){}},[old],fresh),
    {saved:false,reason:"storage-unavailable"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd({
    getItem:s.getItem,setItem(){throw Error("quota");}},[old],fresh),
    {saved:false,reason:"storage-unavailable"});
  assert.equal(s.getItem("balkanbite_shopping"),raw);
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[],fresh),
    {saved:false,reason:"stale-snapshot"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],old),
    {saved:false,reason:"duplicate-id"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old,old],fresh),
    {saved:false,reason:"invalid-view"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],{...fresh,checked:true}),
    {saved:false,reason:"invalid-item"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],{...fresh,quantity:0}),
    {saved:false,reason:"invalid-item"});
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],{...fresh,quantity:Infinity}),
    {saved:false,reason:"invalid-item"});
  s.data.set("balkanbite_guest_cook_intent_v1","pending");
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],fresh),
    {saved:false,reason:"journal-pending"});
  s.data.delete("balkanbite_guest_cook_intent_v1");
  const malformed='[{"id":"old","some":"unknown source bytes"}]';
  s.data.set("balkanbite_shopping",malformed);
  assert.deepEqual(commitVerifiedGuestShoppingAdd(s,[old],fresh),
    {saved:false,reason:"incomplete"});
  assert.equal(s.getItem("balkanbite_shopping"),malformed);
});
test("App guest manual add requires verified source before updating React",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const from=app.indexOf("const handleAddShoppingItem = async");
  const to=app.indexOf("const handleClearShoppingList = async",from);
  assert.ok(from>=0&&to>from);
  const handler=app.slice(from,to);
  assert.match(handler,/commitVerifiedGuestShoppingAdd\(localStorage, shoppingList, newItem\)/);
  assert.match(handler,/if \(!committed\.saved\) \{[\s\S]*?return false;/);
  assert.ok(handler.indexOf("setShoppingList(committed.next)")>handler.indexOf("if (!committed.saved)"));
  assert.match(handler,/submitShoppingItemCreate\(newItem\)/);
  assert.doesNotMatch(handler,/setShoppingList\(prev => \[\.\.\.prev, newItem\]\)/);
});
