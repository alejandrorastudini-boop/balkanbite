import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("REMOVE_ITEMS receives one stable mutation ID that survives a failed retry", () => {
  assert.match(
    voiceSource,
    /const pendingMutationIdRef = useRef<string | null>(null);/,
  );
  assert.match(
    voiceSource,
    /pendingMutationIdRef.current = action === "remove"[sS]*createVoiceRemovalMutationId()[sS]*: null;/,
  );

  const confirmStart = voiceSource.indexOf("const confirmPendingItems");
  const cancelStart = voiceSource.indexOf("const cancelPendingItems", confirmStart);
  assert.ok(confirmStart >= 0 && cancelStart > confirmStart);
  const confirm = voiceSource.slice(confirmStart, cancelStart);
  assert.match(
    confirm,
    /const mutationId = action === "remove" ? pendingMutationIdRef.current : null;/,
  );
  assert.match(confirm, /onDeductItemsFromPantry(confirmedItems, mutationId)/);

  const successClear = confirm.indexOf("pendingMutationIdRef.current = null");
  const succeeded = confirm.indexOf("if (mutationSucceeded)");
  assert.ok(successClear > succeeded);
  assert.doesNotMatch(
    confirm.slice(0, succeeded),
    /pendingMutationIdRef.current = null/,
  );
});

test("cancel/new voice extraction deliberately abandons the old mutation ID", () => {
  const cancelStart = voiceSource.indexOf("const cancelPendingItems");
  const sendStart = voiceSource.indexOf("const handleSend = async", cancelStart);
  assert.ok(cancelStart >= 0 && sendStart > cancelStart);
  assert.match(
    voiceSource.slice(cancelStart, sendStart),
    /pendingMutationIdRef.current = null;/,
  );

  const sendBlock = voiceSource.slice(sendStart, sendStart + 850);
  assert.match(sendBlock, /pendingMutationIdRef.current = null;/);
});

test("hook binds voice deductions to the same visible server-confirmed stock baseline", () => {
  const start = syncSource.indexOf("const submitVoiceInventoryConsumption");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const block = syncSource.slice(start, end);

  assert.match(block, /inventoryServerConfirmedUser !== uid/);
  assert.match(block, /authority.status !== "verified"/);
  assert.match(block, /authority.userId !== uid/);
  assert.match(block, /const visible = pantry.find(item => item.id === pantryItemId)/);
  assert.match(block, /visible.quantity !== observed.quantity/);
  assert.match(block, /visible.unit !== observed.unit/);
  assert.match(block, /(visible.cookRevision ?? 0) !== observed.cookRevision/);
  assert.match(block, /inFlightVoiceConsumptions.current.has(mutationId)/);
  assert.match(block, /persistVerifiedVoiceConsumption(db,/);
  assert.doesNotMatch(block, /setPantry(/);
});

test("signed-in voice deduction tracks exact expected remainder before awaiting commit", () => {
  const start = appSource.indexOf("const handleVoiceDeductItems");
  const end = appSource.indexOf("const handleVoiceNavigateToRecipes", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  const pendingIndex = block.indexOf(
    "pendingSignedInVoiceConsumptions.current.set(mutationId",
  );
  const submitIndex = block.indexOf("submitVoiceInventoryConsumption");
  assert.ok(pendingIndex >= 0 && submitIndex > pendingIndex);
  assert.match(block, /const expectedRemaining: Record<string, number | null> = {};/);
  assert.match(block, /remaining.has(pantryItemId)[sS]*: null;/);

  const signedIn = block.slice(block.indexOf("if (!currentUser)") + 1);
  assert.equal(
    (signedIn.match(/setPantry(result.pantry)/g) || []).length,
    1,
    "the only setPantry occurrence must stay inside the guest branch before signed-in dispatch",
  );
  assert.ok(
    signedIn.indexOf("setPantry(result.pantry)") <
      signedIn.indexOf("if (!mutationId)"),
  );
});

test("derived recipe/meal-plan availability waits for exact committed remainder", () => {
  const marker = "A voice deduction is reconciled only after the exact resulting quantities";
  const start = appSource.indexOf(marker);
  const end = appSource.indexOf("const dispatchSignedInPantryCreations", start);
  assert.ok(start >= 0 && end > start);
  const effect = appSource.slice(start, end);

  assert.match(effect, /if (!inventoryHydrated || !inventoryServerConfirmed) return;/);
  assert.match(effect, /expectedQuantity === null[sS]*!visible.has(itemId)/);
  assert.match(effect, /visible.get(itemId) === expectedQuantity/);
  assert.match(effect, /reconcileCommittedPantryAvailability(pantry, true)/);

  const helperStart = appSource.indexOf(
    "const reconcileCommittedPantryAvailability",
  );
  const helperEnd = appSource.indexOf(
    "const updatePantryAndReconcileMenu",
    helperStart,
  );
  const helper = appSource.slice(helperStart, helperEnd);
  assert.match(helper, /syncRecipesWithPantry(recipes, updatedPantry)/);
  assert.match(helper, /syncMealPlanWithPantry(s*mealPlan,s*updatedPantry,s*)/);
  assert.doesNotMatch(helper, /adaptMealPlanToPantry/);
});
