import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePurchasesIntoPantry, transferCheckedShoppingItems } from '../src/utils/purchasePantryMerge';
import type { PantryItem, ShoppingItem } from '../src/types';
const date = '2026-09-13';
const stock = (quantity = 1, unit = 'kg', overrides: Partial<PantryItem> = {}): PantryItem => ({ id: 'p1', name: 'Tomate', quantity, unit, category: 'Produce', addedAt: date, ...overrides });
const shop = (quantity = .5, unit = 'kg', overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({ id: 's1', name: 'Tomate', quantity, unit, category: 'Produce', checked: true, purchaseAmountConfirmed: true, estimatedPriceEUR: 0, ...overrides });
test('compatible purchase increases existing quantity; transfers only checked items', () => {
 const result = transferCheckedShoppingItems([stock(1,'uds')], [shop(2,'ud'),shop(3,'uds',{ id: 'pending', checked: false })], date);
 assert.equal(result.pantry.length, 1); assert.equal(result.pantry[0].quantity, 3); assert.equal(result.pantry[0].id, 'p1'); assert.equal(result.shoppingList.length, 1);
});
test('converts kg/g and L/ml preserving existing stock unit', () => {
 assert.equal(transferCheckedShoppingItems([stock(.2)], [shop(300,'g')], date).pantry[0].quantity, .5);
 assert.equal(transferCheckedShoppingItems([stock(250,'ml')], [shop(.5,'L')], date).pantry[0].quantity, 750);
});
test('incompatible containers stay separate; identical containers combine', () => {
 for (const unit of ['paquete','botella','bote']) {
  const separate = transferCheckedShoppingItems([stock(1,unit)], [shop(200,'g')], date);
  assert.equal(separate.pantry.length, 2); assert.equal(separate.pantry[0].quantity, 1);
  assert.equal(transferCheckedShoppingItems([stock(1,unit)], [shop(2,unit)], date).pantry[0].quantity, 3);
 }
});
test('same-name purchase batch aggregates, with immutable inputs and replay protection', () => {
 const pantry = [stock()]; const list = [shop(),shop(.25,'kg',{id:'s2'})]; const before = JSON.stringify({pantry,list});
 const first = transferCheckedShoppingItems(pantry,list,date); const second = transferCheckedShoppingItems(first.pantry,list,date);
 assert.equal(first.pantry[0].quantity, 1.75);
 assert.deepEqual(first.acceptedSourceIds, ['shopping:s1','shopping:s2']);
 assert.deepEqual(first.newlyAppliedSourceIds, ['shopping:s1','shopping:s2']);
 assert.deepEqual(second.pantry, first.pantry);
 assert.deepEqual(second.acceptedSourceIds, ['shopping:s1','shopping:s2']);
 assert.deepEqual(second.newlyAppliedSourceIds, []);
 assert.equal(JSON.stringify({pantry,list}), before);
});
test('unknown costs stay unknown; positive line estimates retain provenance', () => {
 const result = transferCheckedShoppingItems([stock(1,'kg',{estimatedCostEUR:2})], [shop()], date).pantry[0];
 assert.equal(result.estimatedCostEUR, null); assert.equal(result.purchaseHistory[0].estimatedCostEUR,2);
 assert.equal(result.purchaseHistory[1].source,'shopping_list'); assert.equal(result.purchaseHistory[1].estimatedCostEUR,undefined);
 assert.equal(transferCheckedShoppingItems([stock(1,'kg',{estimatedCostEUR:2})], [shop(.5,'kg',{estimatedPriceEUR:3})], date).pantry[0].estimatedCostEUR,5);
});
test('unknown expiry is not invented; old warning remains explicitly partial', () => {
 const fresh = transferCheckedShoppingItems([], [shop()], date).pantry[0]; assert.equal(fresh.expiryDaysLeft,undefined);
 const merged = transferCheckedShoppingItems([stock(1,'kg',{expiryDaysLeft:0})], [shop()], date).pantry[0];
 assert.equal(merged.expiryDaysLeft,0); assert.equal(merged.expiryIsPartial,true); assert.equal(merged.purchaseHistory[0].expiryDaysLeft,0);
});
test('invalid items stay in shopping; no default amount or unit; unknown category is Other', () => {
 for (const overrides of [{quantity:0},{quantity:-2},{quantity:NaN},{quantity:Infinity},{unit:''},{name:''},{quantity:'2' as any}]) {
  const result = transferCheckedShoppingItems([], [shop(.5,'kg',overrides)], date);
  assert.equal(result.pantry.length,0); assert.equal(result.shoppingList.length,1); assert.equal(result.rejected.length,1);
 }
 assert.equal(transferCheckedShoppingItems([], [shop(.5,'kg',{category:'fiction'})], date).pantry[0].category,'Other');
});
test('food identity requires exact name or an explicit nonambiguous alias', () => {
 assert.equal(transferCheckedShoppingItems([stock(1,'kg',{name:'Tomate frito'})], [shop()], date).pantry.length,2);
 assert.equal(transferCheckedShoppingItems([stock(1,'kg',{name:'Домати',nameEs:'Tomate'})], [shop()], date).pantry[0].quantity,1.5);
 assert.equal(transferCheckedShoppingItems([stock(1,'kg',{name:'A',nameEs:'Tomate'}),stock(1,'kg',{id:'p2',name:'B',nameEs:'Tomate'})], [shop()], date).pantry.length,3);
});
test('duplicate source IDs reject the entire ambiguous pair', () => {
 const result = transferCheckedShoppingItems([], [shop(),shop(3)], date); assert.equal(result.pantry.length,0); assert.equal(result.shoppingList.length,2);
});
test('confirmed zero cost and expiry are preserved without falsy fallbacks', () => {
 const result = mergePurchasesIntoPantry([], [{sourceId:'r1',source:'confirmed_reconciliation',name:'Tomate',quantity:1,unit:'ud',estimatedCostEUR:0,expiryDaysLeft:0}],date);
 assert.equal(result.pantry[0].estimatedCostEUR,0); assert.equal(result.pantry[0].expiryDaysLeft,0);
});

test('rejected purchases never appear as newly applied progression evidence', () => {
 const result = mergePurchasesIntoPantry([], [
  {sourceId:'bad',source:'confirmed_reconciliation',name:'Tomate',quantity:0,unit:'kg'},
 ], date);
 assert.deepEqual(result.acceptedSourceIds, []);
 assert.deepEqual(result.newlyAppliedSourceIds, []);
 assert.equal(result.rejected.length, 1);
});


test('checked shopping rows without explicit purchased-amount confirmation stay out of pantry', () => {
 const historical = shop(.5, 'kg', { purchaseAmountConfirmed: undefined });
 const result = transferCheckedShoppingItems([], [historical], date);

 assert.equal(result.pantry.length, 0);
 assert.equal(result.shoppingList.length, 1);
 assert.deepEqual(result.acceptedSourceIds, []);
 assert.deepEqual(result.newlyAppliedSourceIds, []);
 assert.equal(result.rejected.length, 1);
 assert.equal(result.rejected[0].reason, 'unconfirmed_amount');
});

test('explicit false purchase confirmation is not equivalent to confirmed', () => {
 const result = transferCheckedShoppingItems([], [
  shop(.5, 'kg', { purchaseAmountConfirmed: false }),
 ], date);

 assert.equal(result.pantry.length, 0);
 assert.equal(result.shoppingList.length, 1);
 assert.equal(result.rejected[0].reason, 'unconfirmed_amount');
});

test('unchecked rows do not need purchase confirmation because they are not transferred', () => {
 const result = transferCheckedShoppingItems([], [
  shop(.5, 'kg', { checked: false, purchaseAmountConfirmed: false }),
 ], date);

 assert.equal(result.pantry.length, 0);
 assert.equal(result.shoppingList.length, 1);
 assert.deepEqual(result.rejected, []);
});


test('new confirmed shopping purchase creates one active lot with estimated provenance', () => {
 const result = transferCheckedShoppingItems([], [
  shop(.5,'kg',{id:'lot-new',estimatedPriceEUR:3}),
 ], date);
 assert.deepEqual(result.newlyAppliedSourceIds,['shopping:lot-new']);
 assert.deepEqual(result.pantry[0].lotState,{
  version:1,
  unallocatedQuantity:0,
  activeLots:[{
   id:'acquisition:shopping:lot-new',
   sourceId:'shopping:lot-new',
   source:'shopping_list',
   acquiredAt:date,
   initialQuantity:.5,
   remainingQuantity:.5,
   initialEstimatedCostEUR:3,
  }],
 });
});

test('confirmed purchase merged into legacy stock keeps old quantity unallocated and lots only the new acquisition', () => {
 const result = transferCheckedShoppingItems([stock(1,'kg')], [
  shop(500,'g',{id:'lot-merge',estimatedPriceEUR:2}),
 ], date);
 assert.equal(result.pantry[0].quantity,1.5);
 assert.deepEqual(result.pantry[0].lotState,{
  version:1,
  unallocatedQuantity:1,
  activeLots:[{
   id:'acquisition:shopping:lot-merge',
   sourceId:'shopping:lot-merge',
   source:'shopping_list',
   acquiredAt:date,
   initialQuantity:.5,
   remainingQuantity:.5,
   initialEstimatedCostEUR:2,
  }],
 });
});

test('purchase replay does not append a second active lot', () => {
 const list=[shop(.5,'kg',{id:'lot-replay'})];
 const first=transferCheckedShoppingItems([],list,date);
 const second=transferCheckedShoppingItems(first.pantry,list,date);
 assert.deepEqual(second.newlyAppliedSourceIds,[]);
 assert.deepEqual(second.pantry,first.pantry);
 assert.equal(second.pantry[0].lotState?.activeLots.length,1);
});

test('invalid lot overlay evidence degrades to unallocated without losing a valid aggregate purchase', () => {
 const result=mergePurchasesIntoPantry([], [{
  sourceId:'r-invalid-date',
  source:'confirmed_reconciliation',
  name:'Tomate',
  quantity:1,
  unit:'kg',
 }], 'not-a-date');
 assert.equal(result.pantry[0].quantity,1);
 assert.equal(result.pantry[0].lotState,undefined);
 assert.deepEqual(result.newlyAppliedSourceIds,['r-invalid-date']);
});

test('new purchase repairs an inconsistent prior lot overlay conservatively', () => {
 const prior=stock(1,'kg',{
  lotState:{
   version:1,
   unallocatedQuantity:0,
   activeLots:[{
    id:'shopping:old',
    sourceId:'shopping:old',
    source:'shopping_list',
    acquiredAt:date,
    initialQuantity:.25,
    remainingQuantity:.25,
   }],
  },
 });
 const result=transferCheckedShoppingItems([prior],[shop(.5,'kg',{id:'lot-repair'})],date);
 assert.equal(result.pantry[0].quantity,1.5);
 assert.equal(result.pantry[0].lotState?.unallocatedQuantity,1);
 assert.equal(result.pantry[0].lotState?.activeLots.length,1);
 assert.equal(result.pantry[0].lotState?.activeLots[0].sourceId,'shopping:lot-repair');
});
