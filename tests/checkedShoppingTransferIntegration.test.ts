import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("guest checked-shopping transfer remains local while signed-in path is transactional", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes("if (!currentUser)"));
  assert.ok(block.includes("setPantry(preview.pantry)"));
  assert.ok(block.includes("setShoppingList(preview.shoppingList)"));
  assert.ok(block.includes("submitPurchasePantryTransfer("));

  const signedStart = block.indexOf("const reviewSignature");
  assert.ok(signedStart >= 0);
  const signedBlock = block.slice(signedStart);
  assert.equal(signedBlock.includes("setPantry("), false);
  assert.equal(signedBlock.includes("setShoppingList("), false);
  assert.equal(
    signedBlock.includes("appendLocalProgressionEvents("),
    false,
    "signed-in progression must wait for committed listener state",
  );
});

test("signed-in transfer uses only explicitly confirmed purchased amounts", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes(
    "item => item.purchaseAmountConfirmed === true",
  ));
  assert.ok(block.includes(
    "const purchases = confirmedItems.map(shoppingItemToPurchase)",
  ));
  assert.ok(block.includes(
    "purchases.length === 0 || preview.acceptedSourceIds.length === 0",
  ));
});

test("reviewed shopping set keeps one stable mutation ID and rejects changed selection", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "pendingCheckedShoppingTransfer.current",
    "pending.reviewSignature !== reviewSignature",
    "purchaseTransferSequenceRef.current += 1",
    "globalThis.crypto?.randomUUID",
    "pending.occurredAt.split(\"T\")[0]",
    "pending.readyToReconcile = true",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
  assert.ok(block.includes(
    'result.reason === "in-flight"',
  ));
  assert.ok(block.includes(
    'result.reason === "unverified-authority"',
  ));
  const catchIndex = block.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "pendingCheckedShoppingTransfer.current = null",
    ),
    false,
    "uncertain transport failure must preserve the same mutation",
  );
});

test("hook caches the original pantry/purchases/shopping rows across uncertain retry", () => {
  const start = syncSource.indexOf("const submitPurchasePantryTransfer");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const block = syncSource.slice(start, end);

  for (const expected of [
    "inventoryServerConfirmedUser !== uid",
    'inventoryEditAuthority.current.status !== "verified"',
    "preparedPurchaseTransfers.current.get(mutationId)",
    "baselinePantry: pantry.map(item => ({ ...item }))",
    "purchases: (purchases || []).map(item => ({ ...item }))",
    "shoppingItems: (shoppingItems || []).map(item => ({ ...item }))",
    "persistPurchasesIntoPantryAtomically(db,",
    "shoppingItemsToRemove: prepared.shoppingItems",
  ]) {
    assert.ok(block.includes(expected), expected);
  }

  const catchIndex = block.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "preparedPurchaseTransfers.current.delete(mutationId)",
    ),
    false,
    "uncertain failure must retain exact baseline and reviewed rows",
  );
  assert.equal(block.includes("setPantry("), false);
  assert.equal(block.includes("setShoppingList("), false);
});

test("progression and menu wait for exact committed stock plus removed shopping rows", () => {
  const marker =
    "Checked shopping transfer is complete only when both sides of the";
  const start = appSource.indexOf(marker);
  const end = appSource.indexOf("const dispatchSignedInPantryCreations", start);
  assert.ok(start >= 0 && end > start);
  const effect = appSource.slice(start, end);

  for (const expected of [
    "!pending.readyToReconcile",
    "visible.quantity === change.quantity",
    "visible.unit === change.unit",
    "(visible.cookRevision ?? 0) === change.cookRevision",
    "pending.removedShoppingItemIds.some(id => shoppingIds.has(id))",
    "appendLocalProgressionEvents(",
    "pending.newlyAppliedSourceIds",
    "reconcilePantryDerivedState(pantry, true)",
  ]) {
    assert.ok(effect.includes(expected), expected);
  }

  const clearIndex = effect.indexOf(
    "pendingCheckedShoppingTransfer.current = null",
  );
  const progressionIndex = effect.indexOf("appendLocalProgressionEvents(");
  assert.ok(clearIndex >= 0 && progressionIndex > clearIndex);
});
