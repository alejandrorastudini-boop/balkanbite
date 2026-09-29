import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(
  new URL("../src/components/VoiceShoppingReconcileModal.tsx", import.meta.url),
  "utf8",
);

test("review modal awaits atomic reconciliation and closes only on accepted result", () => {
  assert.ok(modalSource.includes("}) => boolean | Promise<boolean>;"));
  const start = modalSource.indexOf("const handleConfirmAndSave = async");
  const end = modalSource.indexOf("if (!isOpen) return null", start);
  assert.ok(start >= 0 && end > start);
  const block = modalSource.slice(start, end);

  const saving = block.indexOf("setIsSaving(true)");
  const awaited = block.indexOf("await Promise.resolve(");
  const success = block.indexOf("if (saved)", awaited);
  const close = block.indexOf("onClose()", success);
  const failure = block.indexOf("setAnalysisError(", close);
  const done = block.indexOf("setIsSaving(false)", failure);
  assert.ok(saving >= 0 && awaited > saving);
  assert.ok(success > awaited && close > success);
  assert.ok(failure > close && done > failure);
});

test("failed modal save preserves same reconciliation ID and review for retry", () => {
  const start = modalSource.indexOf("const handleConfirmAndSave = async");
  const end = modalSource.indexOf("if (!isOpen) return null", start);
  const block = modalSource.slice(start, end);
  assert.ok(block.includes(
    "const reconciliationId = reconciliationIdRef.current",
  ));
  assert.equal(block.includes('reconciliationIdRef.current = ""'), false);
  assert.ok(block.includes(
    "The purchase was not confirmed. Your review is preserved for a safe retry.",
  ));
});

test("signed-in reviewed reconciliation builds only preview-accepted purchases and shopping rows", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "buildConfirmedShoppingReconciliationInput(",
    "reconcileConfirmedShoppingPurchases(",
    "const accepted = new Set(preview.acceptedSourceIds)",
    "input.purchases.filter(",
    "accepted.has(purchase.sourceId)",
    "shoppingList.filter(",
    "accepted.has(`shopping:${item.id}`)",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
});

test("guest reconciliation remains local; signed-in branch never writes pantry/list optimistically", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  const guest = block.indexOf("if (!currentUser)");
  const guestPantry = block.indexOf("setPantry(preview.pantry)", guest);
  const guestShopping = block.indexOf("setShoppingList(preview.shoppingList)", guest);
  const signedStart = block.indexOf("if (", guestShopping + 1);
  assert.ok(guest >= 0 && guestPantry > guest && guestShopping > guestPantry);
  assert.ok(signedStart > guestShopping);
  assert.equal(block.slice(signedStart).includes("setPantry("), false);
  assert.equal(block.slice(signedStart).includes("setShoppingList("), false);
});

test("same reconciliation ID and review reuse one mutation; changed review is blocked", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "preparedReviewedShoppingReconciliation.current",
    "prepared.reconciliationId !== safeReconciliationId",
    "prepared.reviewSignature !== reviewSignature",
    "mutationId: `purchase-reconcile-${safeReconciliationId}`",
    "pending.reviewSignature !== reviewSignature",
    "pending.mutationId !== prepared.mutationId",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
});

test("reviewed reconciliation calls strong stock+shopping atomic transfer", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  const pending = block.indexOf(
    "pendingCheckedShoppingTransfer.current = pending",
  );
  const submit = block.indexOf("submitPurchasePantryTransfer(", pending);
  assert.ok(pending >= 0 && submit > pending);
  assert.ok(block.includes("prepared.purchases"));
  assert.ok(block.includes("prepared.shoppingItemsToRemove"));
  assert.ok(block.includes("prepared.acquiredAt"));
  assert.equal(block.includes("submitPurchasePantryApplication("), false);
});

test("definitive failure clears review; uncertain failure keeps exact request for retry", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  const needsReview = block.indexOf('result.outcome === "needs-review"');
  assert.ok(needsReview >= 0);
  assert.ok(block.includes('result.reason === "in-flight"'));
  assert.ok(block.includes('result.reason === "unverified-authority"'));
  const definitiveClear = block.indexOf(
    "preparedReviewedShoppingReconciliation.current = null",
    needsReview,
  );
  assert.ok(definitiveClear > needsReview);

  const catchIndex = block.indexOf("catch (error)", definitiveClear);
  assert.ok(catchIndex > definitiveClear);
  assert.equal(
    block.slice(catchIndex).includes(
      "preparedReviewedShoppingReconciliation.current = null",
    ),
    false,
    "transport uncertainty must retain exact reviewed request",
  );
});

test("accepted result feeds existing exact stock+shopping listener checkpoint", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "pending.expectedChanges = result.expectedChanges.map",
    "pending.removedShoppingItemIds = [...result.removedShoppingItemIds]",
    "pending.newlyAppliedSourceIds = [...result.newlyAppliedSourceIds]",
    "pending.readyToReconcile = true",
    "setPurchaseTransferCheckpoint(value => value + 1)",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
});
