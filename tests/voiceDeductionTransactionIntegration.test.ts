import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("REMOVE_ITEMS gets one stable mutation ID and failure does not clear it", () => {
  assert.ok(voiceSource.includes(
    "const pendingMutationIdRef = useRef<string | null>(null);",
  ));
  assert.ok(voiceSource.includes(
    'pendingMutationIdRef.current = action === "remove"',
  ));
  assert.ok(voiceSource.includes("createVoiceRemovalMutationId()"));

  const confirmStart = voiceSource.indexOf("const confirmPendingItems");
  const cancelStart = voiceSource.indexOf("const cancelPendingItems", confirmStart);
  assert.ok(confirmStart >= 0 && cancelStart > confirmStart);
  const confirm = voiceSource.slice(confirmStart, cancelStart);
  assert.ok(confirm.includes(
    'const mutationId = action === "remove" ? pendingMutationIdRef.current : null;',
  ));
  assert.ok(confirm.includes(
    "onDeductItemsFromPantry(confirmedItems, mutationId)",
  ));

  const success = confirm.indexOf("if (mutationSucceeded)");
  const clear = confirm.indexOf("pendingMutationIdRef.current = null");
  assert.ok(success >= 0 && clear > success);
  assert.equal(
    confirm.slice(0, success).includes("pendingMutationIdRef.current = null"),
    false,
  );
});

test("cancel or a new extraction deliberately abandons the old voice mutation ID", () => {
  const cancelStart = voiceSource.indexOf("const cancelPendingItems");
  const sendStart = voiceSource.indexOf("const handleSend = async", cancelStart);
  assert.ok(cancelStart >= 0 && sendStart > cancelStart);
  assert.ok(
    voiceSource.slice(cancelStart, sendStart)
      .includes("pendingMutationIdRef.current = null"),
  );

  const sendBlock = voiceSource.slice(sendStart, sendStart + 950);
  assert.ok(sendBlock.includes("pendingMutationIdRef.current = null"));
});

test("hook caches the first exact stock baseline/allocation across uncertain retry", () => {
  const start = syncSource.indexOf("const submitVoiceInventoryConsumption");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const block = syncSource.slice(start, end);

  for (const expected of [
    "inventoryServerConfirmedUser !== uid",
    'authority.status !== "verified"',
    "authority.userId !== uid",
    "preparedVoiceConsumptions.current.get(mutationId)",
    "const visible = pantry.find(item => item.id === pantryItemId)",
    "visible.quantity !== observed.quantity",
    "visible.unit !== observed.unit",
    "(visible.cookRevision ?? 0) !== observed.cookRevision",
    "preparedVoiceConsumptions.current.set(mutationId, prepared)",
    "inFlightVoiceConsumptions.current.has(mutationId)",
    "persistVerifiedVoiceConsumption(db,",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
  assert.equal(block.includes("setPantry("), false);
  const catchIndex = block.indexOf("catch (error)");
  const deleteBeforeCatch = block.lastIndexOf(
    "preparedVoiceConsumptions.current.delete(mutationId)",
    catchIndex,
  );
  assert.ok(deleteBeforeCatch >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "preparedVoiceConsumptions.current.delete(mutationId)",
    ),
    false,
    "transport failure must retain the original prepared request",
  );
});

test("App caches reviewed deductions and exact expected remainder before dispatch", () => {
  const start = appSource.indexOf("const handleVoiceDeductItems");
  const end = appSource.indexOf("const handleVoiceNavigateToRecipes", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "preparedSignedInVoiceDeductions.current.get(mutationId)",
    "const resolved = deductVoiceItemsFromPantry(pantry, items || [])",
    "const expectedRemaining: Record<string, number | null> = {}",
    "preparedSignedInVoiceDeductions.current.set(mutationId, plan)",
    "pendingSignedInVoiceConsumptions.current.set(mutationId",
    "submitVoiceInventoryConsumption(",
    "plan.deductions",
    'persisted.reason === "in-flight"',
    'persisted.reason === "unverified-authority"',
  ]) {
    assert.ok(block.includes(expected), expected);
  }

  const guestStart = block.indexOf("if (!currentUser)");
  const mutationCheck = block.indexOf("if (!mutationId)");
  const guestSet = block.indexOf("setPantry(guestResult.pantry)");
  assert.ok(guestStart >= 0 && guestSet > guestStart && mutationCheck > guestSet);
  assert.equal(
    block.slice(mutationCheck).includes("setPantry("),
    false,
    "signed-in branch must never mutate pantry optimistically",
  );

  const catchIndex = block.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "preparedSignedInVoiceDeductions.current.delete(mutationId)",
    ),
    false,
    "uncertain client failure must retain original reviewed plan",
  );
});

test("derived recipe/meal-plan availability waits for exact server-confirmed remainder", () => {
  const marker =
    "A voice deduction is reconciled only after the exact resulting quantities";
  const start = appSource.indexOf(marker);
  const end = appSource.indexOf("const dispatchSignedInPantryCreations", start);
  assert.ok(start >= 0 && end > start);
  const effect = appSource.slice(start, end);

  for (const expected of [
    "if (!inventoryHydrated || !inventoryServerConfirmed) return",
    "expectedQuantity === null",
    "!visible.has(itemId)",
    "visible.get(itemId) === expectedQuantity",
    "reconcileCommittedPantryAvailability(pantry, true)",
  ]) {
    assert.ok(effect.includes(expected), expected);
  }

  const helperStart = appSource.indexOf(
    "const reconcileCommittedPantryAvailability",
  );
  const helperEnd = appSource.indexOf(
    "const updatePantryAndReconcileMenu",
    helperStart,
  );
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = appSource.slice(helperStart, helperEnd);
  assert.ok(helper.includes("syncRecipesWithPantry(recipes, updatedPantry)"));
  assert.ok(helper.includes("syncMealPlanWithPantry("));
  assert.equal(helper.includes("adaptMealPlanToPantry"), false);
});
