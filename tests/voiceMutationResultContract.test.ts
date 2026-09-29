import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../src/components/ChefIaModal.tsx", import.meta.url),
  "utf8",
);

test("voice mutation callbacks return explicit sync or awaited boolean results through both UI surfaces", () => {
  for (const source of [voiceSource, modalSource]) {
    assert.match(
      source,
      /onAddItemsToPantry:\s*\(items: any\[\]\) => boolean \| Promise<boolean>;/,
    );
    assert.match(
      source,
      /onAddItemsToShoppingList:\s*\(items: any\[\]\) => boolean \| Promise<boolean>;/,
    );
    assert.match(
      source,
      /onDeductItemsFromPantry:\s*\(items: any\[\], mutationId\?: string\) => boolean \| Promise<boolean>;/,
    );
  }
});

test("App returns false when confirmed pantry add cannot be authoritatively applied", () => {
  const start = appSource.indexOf("const handleVoiceAddItems");
  const end = appSource.indexOf("const handleVoiceAddShoppingItems", start);
  const block = appSource.slice(start, end);

  assert.match(block, /const handleVoiceAddItems = async \(items: any\[\]\): Promise<boolean>/);
  assert.match(block, /if \(rejectedCount > 0\)[\s\S]*return false;/);
  assert.match(block, /if \(parsed\.length === 0\) return false;/);
  assert.match(block, /return updatePantryAndReconcileMenu\(parsed, true\);/);
});

test("App returns true only after a valid confirmed shopping batch is scheduled", () => {
  const start = appSource.indexOf("const handleVoiceAddShoppingItems");
  const end = appSource.indexOf("const handleVoiceDeductItems", start);
  const block = appSource.slice(start, end);

  assert.match(block, /\(items: any\[\]\): boolean/);
  assert.match(block, /if \(result\.rejectedCount > 0\)[\s\S]*return false;/);
  assert.match(block, /if \(result\.items\.length === 0\) return false;/);

  const persistIndex = block.indexOf(
    "setShoppingList((prev) => [...prev, ...result.items])",
  );
  const successIndex = block.indexOf("return true;", persistIndex);
  assert.ok(persistIndex >= 0);
  assert.ok(successIndex > persistIndex);
});

test("App computes exact deductions before any mutation and keeps signed-in stock transactional", () => {
  const start = appSource.indexOf("const handleVoiceDeductItems");
  const end = appSource.indexOf("const handleVoiceNavigateToRecipes", start);
  const block = appSource.slice(start, end);

  assert.match(block, /async \([\s\S]*mutationId\?: string,[\s\S]*\): Promise<boolean>/);
  assert.match(block, /if \(!requireAuthoritativeInventory\(\)\) return false;/);
  assert.match(
    block,
    /const result = deductVoiceItemsFromPantry\(pantry, items \|\| \[\]\);/,
  );
  assert.match(
    block,
    /if \(result\.issues\.length > 0 \|\| result\.deductions\.length === 0\)[\s\S]*return false;/,
  );
  assert.match(
    block,
    /if \(!currentUser\) \{\s*setPantry\(result\.pantry\);\s*return true;\s*\}/,
  );
  assert.match(block, /if \(!mutationId\)[\s\S]*return false;/);
  assert.match(block, /pendingSignedInVoiceConsumptions\.current\.set\(mutationId,/);
  assert.match(
    block,
    /await submitVoiceInventoryConsumption\(\s*mutationId,\s*result\.deductions,\s*\)/,
  );

  const signedInStart = block.indexOf("if (!currentUser)");
  const submitIndex = block.indexOf("submitVoiceInventoryConsumption", signedInStart);
  assert.ok(signedInStart >= 0 && submitIndex > signedInStart);
  assert.doesNotMatch(block.slice(submitIndex), /setPantry\(result\.pantry\)/);
});

test("VoiceChefView keeps the pending batch when App rejects the mutation", () => {
  const start = voiceSource.indexOf("const confirmPendingItems");
  const end = voiceSource.indexOf("const cancelPendingItems", start);
  const block = voiceSource.slice(start, end);

  assert.match(block, /let mutationSucceeded = false;/);
  assert.match(block, /mutationSucceeded = await Promise\.resolve\(/);
  assert.match(block, /onAddItemsToPantry\(confirmedItems\)/);
  assert.match(block, /onDeductItemsFromPantry\(confirmedItems\)/);
  assert.match(block, /onAddItemsToShoppingList\(confirmedItems\)/);
  assert.match(
    block,
    /if \(mutationSucceeded\) \{\s*setPendingItems\(null\);\s*setPendingAction\(null\);\s*\}/,
  );

  const resultIndex = block.indexOf("let mutationSucceeded = false");
  const clearIndex = block.indexOf("setPendingItems(null)");
  assert.ok(resultIndex >= 0);
  assert.ok(clearIndex > resultIndex);
});

test("VoiceChefView only emits mutation success copy when App returns true", () => {
  const start = voiceSource.indexOf("const confirmPendingItems");
  const end = voiceSource.indexOf("const cancelPendingItems", start);
  const block = voiceSource.slice(start, end);

  assert.match(block, /const confirmationText = mutationSucceeded/);
  assert.match(block, /Confirmed\. Added to the pantry:/);
  assert.match(block, /Confirmed\. Deducted from the pantry:/);
  assert.match(block, /Confirmed\. Added to the shopping list:/);

  assert.match(
    block,
    /I did not save these items to the pantry\. Review the name, quantity, and unit and try again\./,
  );
  assert.match(
    block,
    /I did not deduct anything from the pantry\. Review the item, quantity, and unit and try again\./,
  );
  assert.match(
    block,
    /I did not add these items to the shopping list\. Review the name, quantity, and unit and try again\./,
  );
});

test("pantry reconcile helper exposes whether the authoritative gate accepted scheduling", () => {
  const start = appSource.indexOf("const updatePantryAndReconcileMenu");
  const end = appSource.indexOf("const shoppingDiagnostic", start);
  const block = appSource.slice(start, end);

  assert.match(block, /\): boolean =>/);
  assert.match(block, /if \(!requireAuthoritativeInventory\(\)\) return false;/);
  assert.match(block, /setPantry\(\(prevPantry\) =>/);
  assert.match(block, /return true;/);
});
