import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, Recipe, ShoppingItem, MealPlanDay } from "../src/types";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import {
  GUEST_VOICE_INTENT_KEY as INTENT,
  GUEST_VOICE_RECEIPTS_KEY as RECEIPTS,
  commitGuestVoiceRemoval, recoverGuestVoiceRemoval, type GuestVoiceCommand,
} from "../src/utils/guestVoiceRemovalIntent";
import { deductVoiceItemsFromPantry } from "../src/utils/pantryConsumption";
import { syncRecipesWithPantry } from "../src/utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "../src/utils/shoppingAdvisor";
import { reconcileDerivedShortageShoppingItems } from "../src/utils/derivedShortageShopping";

const RECIPES = "balkanbite_recipes", PLAN = "balkanbite_mealplan", SHOP = "balkanbite_shopping";
const stock: PantryItem[] = [{
  id: "qa-rice", name: "QA Rice", quantity: 150, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-14",
}];
const recipe: Recipe = {
  id: "qa-voice-rice-recipe", title: { en: "Rice", es: "Arroz", bg: "Ориз" },
  description: { en: "QA", es: "QA", bg: "QA" }, prepTimeMin: 0, cookTimeMin: 0,
  costPerServingEUR: 0, difficulty: "easy", servings: 1, calories: 0, proteinG: 0,
  carbsG: 0, fatG: 0, fiberG: 0, tags: [],
  ingredients: [{ name: "QA Rice", amount: 100, unit: "g", inPantry: true }],
  instructions: { en: ["Cook"], es: ["Cocinar"], bg: ["Готви"] },
  nutritionHighlights: { en: "QA", es: "QA", bg: "QA" },
};
const manual: ShoppingItem = {
  id: "manual-salt", name: "Salt", category: "Other", quantity: 1, unit: "kg",
  checked: false, amountOrigin: "user_entered", purchaseAmountConfirmed: false,
};
const date = "2026-10-16T13:00:00.000Z";
const items = [{ name: "QA Rice", quantity: 100, unit: "g" }];
const plan: MealPlanDay[] = [{ date: "2026-10-16", breakfast: recipe }];
const afterStock = deductVoiceItemsFromPantry(stock, items, new Date(date)).pantry;
const afterRecipes = syncRecipesWithPantry([recipe], afterStock, new Date(date));
const afterShopping = reconcileDerivedShortageShoppingItems(
  [manual], evaluateShoppingNeeds(afterStock, plan, [manual], "en", new Date(date)).itemsToAddToShoppingList,
).next;
const cmd = (): GuestVoiceCommand => ({
  mutationId: "voice-qa-removal-1", purpose: "food-use", occurredAt: date,
  language: "en", items,
  expectedPantry: stock, expectedRecipes: [recipe], expectedPlan: [],
  expectedShopping: [manual], nextPlan: plan, nextRecipes: afterRecipes,
  nextShopping: afterShopping,
});
const keys = [GUEST_PANTRY_KEY, RECIPES, PLAN, SHOP, RECEIPTS];
type Failure = "throw" | "silent";
function fixture({ missingReceipt = false } = {}) {
  const data = new Map<string,string>([
    [GUEST_PANTRY_KEY, JSON.stringify(stock)],
    [RECIPES, JSON.stringify([recipe])], [PLAN, "[]"],
    [SHOP, JSON.stringify([manual])],
    ...(!missingReceipt ? [[RECEIPTS, "[]"] as [string,string]] : []),
  ]);
  const failures = new Map<string, Failure>();
  const writes = new Map<string,number>();
  let keepMarker = false;
  const storage = {
    getItem(key: string) {return data.get(key) ?? null;},
    setItem(key: string, value: string) {
      if (failures.get(key) === "throw") throw new Error("synthetic quota");
      if (failures.get(key) === "silent") return;
      data.set(key,value);
      writes.set(key,(writes.get(key)||0)+1);
    },
    removeItem(key: string) {if (!keepMarker) data.delete(key);},
  };
  return {data,failures,writes,storage,keepMarker(v:boolean){keepMarker=v;}};
}
const quantity=(f:ReturnType<typeof fixture>)=>
  JSON.parse(f.data.get(GUEST_PANTRY_KEY)!)?.[0]?.quantity as number;
function assertCompleted(f: ReturnType<typeof fixture>) {
  assert.equal(quantity(f),50);
  assert.deepEqual(JSON.parse(f.data.get(RECIPES)!),afterRecipes);
  assert.deepEqual(JSON.parse(f.data.get(PLAN)!),plan);
  assert.deepEqual(JSON.parse(f.data.get(SHOP)!),afterShopping);
  assert.deepEqual(JSON.parse(f.data.get(SHOP)!)
    .filter((x:ShoppingItem)=>x.id===manual.id),[manual]);
  const rec=JSON.parse(f.data.get(RECEIPTS)!);
  assert.deepEqual(rec,[{
    version:1,mutationId:"voice-qa-removal-1",purpose:"food-use",items,
  }]);
  assert.equal(f.data.has(INTENT),false);
}

test("guest voice creates a purpose-aware receipt only after durable multi-key removal",()=>{
  const f=fixture();
  assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{status:"saved"});
  assertCompleted(f);
  assert.equal(f.writes.get(GUEST_PANTRY_KEY),1);
  assert.equal(f.writes.get(RECEIPTS),1);
  assert.deepEqual(recoverGuestVoiceRemoval(f.storage),{status:"none"});
});
test("repeated voice mutationId returns already-applied without recomputing stock",()=>{
  const f=fixture();
  assert.equal(commitGuestVoiceRemoval(f.storage,cmd()).status,"saved");
  const result=commitGuestVoiceRemoval(f.storage,{
    ...cmd(),expectedPantry:JSON.parse(f.data.get(GUEST_PANTRY_KEY)!),
    expectedRecipes:JSON.parse(f.data.get(RECIPES)!),
    expectedPlan:JSON.parse(f.data.get(PLAN)!),
    expectedShopping:JSON.parse(f.data.get(SHOP)!),
  });
  assert.deepEqual(result,{status:"already-applied"});
  assert.equal(f.writes.get(GUEST_PANTRY_KEY),1);
  assertCompleted(f);
});
test("reusing mutationId with changed amount or purpose is a conflict, not a second deduction",()=>{
  const f=fixture();
  commitGuestVoiceRemoval(f.storage,cmd());
  for(const changed of [{items:[{name:"QA Rice",quantity:50,unit:"g"}]},{purpose:"discard" as const}]){
    assert.deepEqual(commitGuestVoiceRemoval(f.storage,{...cmd(),...changed}),{
      status:"blocked",reason:"mutation-conflict",
    });
  }
  assertCompleted(f);
});
test("malformed historical receipts are never silently overwritten",()=>{
  const f=fixture();
  f.data.set(RECEIPTS,'[{"broken":"source"}]');
  assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{
    status:"blocked",reason:"invalid-input",
  });
  assert.equal(f.data.get(RECEIPTS),'[{"broken":"source"}]');
  assert.equal(f.writes.get(GUEST_PANTRY_KEY)||0,0);
});
test("missing internal receipt registry can initialize without inventing food or nutrition facts",()=>{
  const f=fixture({missingReceipt:true});
  assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{status:"saved"});
  assertCompleted(f);
});
test("invalid voice amount, unit, purpose or missing mutationId cannot stage a removal",()=>{
  const bad: Partial<GuestVoiceCommand>[]=[
    {mutationId:""}, {purpose:"use" as GuestVoiceCommand["purpose"]},
    {items:[{name:"QA Rice",quantity:0,unit:"g"}]},
    {items:[{name:"QA Rice",quantity:100,unit:""}]},
    {items:[{name:"QA Rice",quantity:100,unit:"kg"}]},
    {nextShopping:[{...manual,quantity:999}]},
  ];
  for(const change of bad){
    const f=fixture();assert.equal(commitGuestVoiceRemoval(f.storage,{...cmd(),...change}).status,"blocked");
    assert.equal(f.data.has(INTENT),false);
    assert.equal(f.writes.get(GUEST_PANTRY_KEY)||0,0);
  }
});
test("journal quota or silent write prevents stock removal",()=>{
  for(const mode of ["throw","silent"] as const){
    const f=fixture();f.failures.set(INTENT,mode);
    assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{
      status:"blocked",reason:"storage-unavailable",
    });
    assert.equal(quantity(f),150);
    assert.equal(f.writes.get(GUEST_PANTRY_KEY)||0,0);
  }
});
test("failures at each of five stages never repeat stock deduction on replay",()=>{
  for(const key of keys)for(const mode of ["throw","silent"] as const){
    const f=fixture();
    f.failures.set(key,mode);
    assert.equal(commitGuestVoiceRemoval(f.storage,cmd()).status,"blocked",key);
    assert.ok(f.data.has(INTENT),key);
    f.failures.clear();
    const recovered=recoverGuestVoiceRemoval(f.storage);
    if(key===GUEST_PANTRY_KEY){
      assert.deepEqual(recovered,{status:"unapplied"});
      assert.equal(quantity(f),150);
    }else{
      assert.deepEqual(recovered,{status:"completed-derived-writes"},key);
      assertCompleted(f);
      assert.equal(f.writes.get(GUEST_PANTRY_KEY),1);
      assert.deepEqual(recoverGuestVoiceRemoval(f.storage),{status:"none"});
    }
  }
});
test("interleaved foreign bytes prevent replay and preserve original user data",()=>{
  for(const key of keys){
    const f=fixture();
    f.failures.set(RECEIPTS,"silent");
    assert.equal(commitGuestVoiceRemoval(f.storage,cmd()).status,"blocked");
    f.failures.clear();
    const changed= key===GUEST_PANTRY_KEY
      ? JSON.stringify([{...stock[0],quantity:77}])
      : '[{"unknown":"foreign"}]';
    f.data.set(key,changed);
    assert.deepEqual(recoverGuestVoiceRemoval(f.storage),{status:"blocked",reason:"conflict"});
    assert.equal(f.data.get(key),changed);
    assert.ok(f.data.has(INTENT));
  }
});
test("tampered journal cannot manufacture a receipt on recovery",()=>{
  const f=fixture();
  f.failures.set(SHOP,"silent");
  assert.equal(commitGuestVoiceRemoval(f.storage,cmd()).status,"blocked");
  f.failures.clear();
  const tampered=JSON.parse(f.data.get(INTENT)!);
  tampered.after[0]=JSON.stringify(stock);
  f.data.set(INTENT,JSON.stringify(tampered));
  assert.deepEqual(recoverGuestVoiceRemoval(f.storage),{
    status:"blocked",reason:"invalid-intent",
  });
  assert.equal(f.data.get(RECEIPTS),"[]");
});
test("cleanup loss after success is idempotent and recoverable",()=>{
  const f=fixture();f.keepMarker(true);
  assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{
    status:"saved-pending-cleanup",
  });
  f.keepMarker(false);
  assert.deepEqual(recoverGuestVoiceRemoval(f.storage),{status:"already-complete"});
  assertCompleted(f);
  assert.equal(f.writes.get(GUEST_PANTRY_KEY),1);
});
test("all other guest WAL markers exclude new voice operation",()=>{
  for(const key of [
    "balkanbite_guest_purchase_intent_v1",
    "balkanbite_guest_cook_intent_v1",
    "balkanbite_guest_cook_derived_intent_v1",
    "balkanbite_guest_pantry_shopping_journal_v1",
  ]){
    const f=fixture();f.data.set(key,"pending");
    assert.deepEqual(commitGuestVoiceRemoval(f.storage,cmd()),{
      status:"blocked",reason:"unresolved-intent",
    });
    assert.equal(f.writes.get(GUEST_PANTRY_KEY)||0,0);
  }
});
