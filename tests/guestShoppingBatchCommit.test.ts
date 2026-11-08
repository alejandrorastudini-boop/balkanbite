import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ShoppingItem } from "../src/types";
import { commitVerifiedGuestShoppingBatch } from "../src/utils/guestShoppingAddCommit";

const prior: ShoppingItem = {
  id:"qa-prior", name:"Prior shopping", quantity:1, unit:"uds",category:"",
  checked:false,amountOrigin:"user_entered",purchaseAmountConfirmed:false,
};
const advisor:ShoppingItem = {
  id:"qa-advisor",name:"QA Rice",quantity:50,unit:"g",category:"",
  checked:false,amountOrigin:"deterministic_shortfall",purchaseAmountConfirmed:false,
};
const voice:ShoppingItem = {
  id:"qa-voice",name:"QA Salt",quantity:1,unit:"uds",category:"",
  checked:false,amountOrigin:"user_entered",purchaseAmountConfirmed:false,
};
const storage=(rows:ShoppingItem[]|null=[prior])=>{
  const data=new Map<string,string>();
  if(rows!==null)data.set("balkanbite_shopping",JSON.stringify(rows));
  return {data,getItem(k:string){return data.get(k)??null;},
    setItem(k:string,v:string){data.set(k,v);}};
};
test("advisor prepends and voice appends only after full verified batch readback",()=>{
  const s=storage();
  let first=commitVerifiedGuestShoppingBatch(s,[prior],[advisor],"prepend");
  assert.deepEqual(first,{saved:true,next:[advisor,prior]});
  assert.deepEqual(JSON.parse(s.getItem("balkanbite_shopping")!),[advisor,prior]);
  let second=commitVerifiedGuestShoppingBatch(s,[advisor,prior],[voice],"append");
  assert.deepEqual(second,{saved:true,next:[advisor,prior,voice]});
  assert.deepEqual(JSON.parse(s.getItem("balkanbite_shopping")!),[advisor,prior,voice]);
});
test("unconfirmed, duplicate or invalid batch never becomes shopping fact",()=>{
  const s=storage(),raw=s.getItem("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[advisor,advisor],"prepend"),
    {saved:false,reason:"duplicate-id"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[prior],"append"),
    {saved:false,reason:"duplicate-id"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[{...voice,checked:true}]),
    {saved:false,reason:"invalid-item"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[{...advisor,purchaseAmountConfirmed:true}]),
    {saved:false,reason:"invalid-item"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[{...advisor,quantity:NaN}]),
    {saved:false,reason:"invalid-item"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[]),
    {saved:false,reason:"invalid-item"});
  assert.equal(s.getItem("balkanbite_shopping"),raw);
});
test("no false success on lost writes, stale views, unknown legacy entries or WAL",()=>{
  const s=storage(),before=s.getItem("balkanbite_shopping");
  assert.deepEqual(commitVerifiedGuestShoppingBatch({getItem:s.getItem,setItem(){}},[prior],[voice]),
    {saved:false,reason:"storage-unavailable"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch({getItem:s.getItem,setItem(){throw Error("quota");}},[prior],[voice]),
    {saved:false,reason:"storage-unavailable"});
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[],[advisor]),
    {saved:false,reason:"stale-snapshot"});
  s.data.set("balkanbite_guest_purchase_intent_v1","pending");
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[voice]),
    {saved:false,reason:"journal-pending"});
  s.data.delete("balkanbite_guest_purchase_intent_v1");
  s.data.set("balkanbite_shopping",'[{"id":"legacy","unknown":"preserve"}]');
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[voice]),
    {saved:false,reason:"incomplete"});
  assert.equal(s.getItem("balkanbite_shopping"), '[{"id":"legacy","unknown":"preserve"}]');
  s.data.set("balkanbite_shopping",before!);
  assert.deepEqual(commitVerifiedGuestShoppingBatch(s,[prior],[advisor],"prepend"),
    {saved:true,next:[advisor,prior]});
});
test("advisor, recipe and voice guest flows use verified batch boundary",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  for (const [begin,end,kind] of [
    ["const handleAddMultipleShoppingItems = async","const handleAdaptMenuToPantry","newItems"],
    ["const handleAddMissingToShopping = async","const handleVoiceAddItems","newShoppingItems"],
    ["const handleVoiceAddShoppingItems = async","const handleVoiceDeductItems","result.items"],
  ]) {
    const from=app.indexOf(begin),to=app.indexOf(end,from);
    assert.ok(from>=0&&to>from);
    const chunk=app.slice(from,to);
    assert.match(chunk,/commitVerifiedGuestShoppingBatch\(/);
    assert.match(chunk,/if \(!committed\.saved\) \{/);
    assert.ok(chunk.indexOf("setShoppingList(committed.next)") > chunk.indexOf("if (!committed.saved)"));
    assert.doesNotMatch(chunk,new RegExp("setShoppingList\\(prev => \\[\\.\\.\\.prev, \\.\\.\\."+kind));
  }
});
