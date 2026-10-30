import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { MealLog } from "../src/types";
import {
  commitVerifiedGuestMealLog, isGuestMealLogSnapshotVerified,
} from "../src/utils/guestMealLogCommit";

const a: MealLog = {
  id: "qa-meal-one", date: "2026-10-30", mealType: "lunch",
  manualName: "QA Lentils", timestamp: "2026-10-30T08:00:00.000Z",
  nutritionDataStatus: "unknown",
};
const b: MealLog = {
  id: "qa-meal-two", date: "2026-10-30", mealType: "dinner",
  manualName: "QA Rice", timestamp: "2026-10-30T19:00:00.000Z",
  nutritionDataStatus: "unknown",
};
const storage=(raw:string|null=null)=>{
  const data = new Map<string,string>();
  if(raw !== null)data.set("balkanbite_meallogs",raw);
  return {data,getItem(k:string){return data.get(k)??null;},
    setItem(k:string,v:string){data.set(k,v);}};
};
test("new meal is saved before success, with unknown nutrition not zero",()=>{
  const s=storage();
  assert.equal(isGuestMealLogSnapshotVerified(s,[]),true);
  const result=commitVerifiedGuestMealLog(s,[],a);
  assert.deepEqual(result,{saved:true,next:[a]});
  assert.equal(JSON.parse(s.getItem("balkanbite_meallogs")!)[0].nutritionDataStatus,"unknown");
  assert.equal(JSON.parse(s.getItem("balkanbite_meallogs")!)[0].calories,undefined);
  assert.equal(isGuestMealLogSnapshotVerified(s,[a]),true);
  assert.equal(commitVerifiedGuestMealLog(s,[a],b).saved,true);
  assert.equal(JSON.parse(s.getItem("balkanbite_meallogs")!).length,2);
});
test("lost and throwing writes never acknowledge a consumed meal",()=>{
  const s=storage(JSON.stringify([a]));
  const prior=s.getItem("balkanbite_meallogs");
  assert.deepEqual(commitVerifiedGuestMealLog({getItem:s.getItem,setItem(){}},[a],b),
    {saved:false,reason:"storage-unavailable"});
  assert.deepEqual(commitVerifiedGuestMealLog({
    getItem:s.getItem,setItem(){throw new Error("quota");}},[a],b),
    {saved:false,reason:"storage-unavailable"});
  assert.equal(s.getItem("balkanbite_meallogs"),prior);
});
test("unknown legacy fields, numeric estimates, invalid rows and duplicated IDs are preserved",()=>{
  const examples=[
    '[{"id":"historic","unknown":"preserve"}]',
    JSON.stringify([ {...a, nutritionDataStatus:"estimated",calories:310} ]),
    JSON.stringify([a,{id:"partial"}]),
    JSON.stringify([a,a]),
    "{ invalid original bytes",
  ];
  for(const raw of examples){
    const s=storage(raw);
    assert.deepEqual(commitVerifiedGuestMealLog(s,[a],b),
      {saved:false,reason:"incomplete-source"});
    assert.equal(s.getItem("balkanbite_meallogs"),raw);
    assert.equal(isGuestMealLogSnapshotVerified(s,[a]),false);
  }
});
test("stale tab, duplicate action, invalid identity and changed readback are blocked",()=>{
  const s=storage(JSON.stringify([a]));
  assert.deepEqual(commitVerifiedGuestMealLog(s,[],b),
    {saved:false,reason:"stale-snapshot"});
  assert.deepEqual(commitVerifiedGuestMealLog(s,[a],a),
    {saved:false,reason:"duplicate-id"});
  assert.deepEqual(commitVerifiedGuestMealLog(s,[a],{...b,date:"unknown"}),
    {saved:false,reason:"invalid-log"});
  const prior=s.getItem("balkanbite_meallogs");
  const changing={
    getItem(k:string){return k==="balkanbite_meallogs" ? (this.calls++ ? "[ ]" : prior) : null;},
    calls:0,
    setItem() {throw new Error("should not write");},
  };
  assert.equal(commitVerifiedGuestMealLog(changing,[a],b).saved,false);
});
test("App guest log no longer writes on hydration or claims success before readback",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const start=app.indexOf("const handleLogMeal = async");
  const end=app.indexOf("const handleGenerateAiShopping =",start);
  assert.ok(start>=0&&end>start);
  const handler=app.slice(start,end);
  assert.match(handler,/commitVerifiedGuestMealLog\(localStorage, mealLogs, newLog\)/);
  assert.match(handler,/if \(!commit\.saved\) \{[\s\S]*?return false;/);
  assert.ok(handler.indexOf("setMealLogs(commit.next)")>handler.indexOf("if (!commit.saved)"));
  assert.match(handler,/submitMealLog\(newLog\)/);
  assert.doesNotMatch(app,/localStorage\.setItem\("balkanbite_meallogs"/);
  assert.match(app,/isGuestMealLogSnapshotVerified\(localStorage, mealLogs\)/);
  assert.match(app,/data-testid="guest-meal-log-review-warning"/);
});
