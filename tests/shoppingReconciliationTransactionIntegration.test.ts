import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(
  new URL("../src/components/VoiceShoppingReconcileModal.tsx", import.meta.url),
  "utf8",
);

test("review modal awaits purchase persistence and closes only on accepted result", () => {
  assert.ok(modalSource.includes(
    "}) => boolean | Promise<boolean>;",
  ));
  const start = modalSource.indexOf("const handleConfirmAndSave = async");
  const end = modalSource.indexOf("if (!isOpen) return null", start);
  assert.ok(start >= 0 && end > start);
  const block = modalSource.slice(start, end);

  const saving = block.indexOf("setIsSaving(true)");
  const awaitResult = block.indexOf("await Promise.resolve(");
  const savedGuard = block.indexOf("if (saved)");
  const close = block.indexOf("onClose()", savedGuard);
  const failureMessage = block.indexOf("setAnalysisError(", close);
  const finallyIndex = block.indexOf("finally", failureMessage);

  assert.ok(saving >= 0 && awaitResult > saving);
  assert.ok(savedGuard > awaitResult && close > savedGuard);
  assert.ok(failureMessage > close && finallyIndex > failureMessage);
  assert.ok(block.includes("setIsSaving(false)"));
});

test("failed reconciliation save preserves the same reconciliation ID for retry", () => {
  const start = modalSource.indexOf("const handleConfirmAndSave = async");
  const end = modalSource.indexOf("if (!isOpen) return null", start);
  const block = modalSource.slice(start, end);

  assert.ok(block.includes(
    "const reconciliationId = reconciliationIdRef.current",
  ));
  assert.equal(
    block.includes('reconciliationIdRef.current = ""'),
    false,
    "save failure must not mint or clear the review identity",
  );
});

test("signed-in advanced reconciliation uses extracted reviewed purchases and shared transaction", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  for (const expected of [
    "buildConfirmedShoppingReconciliationInput(",
    "reconcileConfirmedShoppingPurchases(",
    "preparedSignedInReconciliations.current.get(safeReconciliationId)",
    "prepared.reviewFingerprint !== reviewFingerprint",
    "preparedSignedInReconciliations.current.set(",
    "dispatchSignedInPurchaseApplication(",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
});

test("guest reconciliation remains local but signed-in branch never sets pantry directly", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  const guest = block.indexOf("if (!currentUser)");
  const guestSet = block.indexOf("setPantry(preview.pantry)", guest);
  const signedId = block.indexOf("if (!safeReconciliationId)", guestSet);
  assert.ok(guest >= 0 && guestSet > guest && signedId > guestSet);
  assert.equal(
    block.slice(signedId).includes("setPantry("),
    false,
    "signed-in reconciliation must wait for server-confirmed inventory",
  );
});

test("uncertain retry keeps cached review; definitive outcome clears it", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  const accepted = block.indexOf('if (outcome === "accepted")');
  const acceptedClear = block.indexOf(
    "preparedSignedInReconciliations.current.delete(safeReconciliationId)",
    accepted,
  );
  const rejected = block.indexOf('if (outcome === "rejected")', acceptedClear);
  const rejectedClear = block.indexOf(
    "preparedSignedInReconciliations.current.delete(safeReconciliationId)",
    rejected,
  );
  const uncertainComment = block.indexOf("Uncertain/in-flight", rejectedClear);

  assert.ok(accepted >= 0 && acceptedClear > accepted);
  assert.ok(rejected > acceptedClear && rejectedClear > rejected);
  assert.ok(uncertainComment > rejectedClear);
  assert.equal(
    block.slice(uncertainComment).includes(
      "preparedSignedInReconciliations.current.delete",
    ),
    false,
  );
});

test("changed review is blocked while prior reconciliation remains pending", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes(
    "prepared.reviewFingerprint !== reviewFingerprint",
  ));
  assert.ok(block.includes(
    "The previous attempt is still awaiting confirmation.",
  ));
  const changedGuard = block.indexOf(
    "prepared.reviewFingerprint !== reviewFingerprint",
  );
  const dispatch = block.indexOf(
    "dispatchSignedInPurchaseApplication(",
    changedGuard,
  );
  const returnFalse = block.indexOf("return false", changedGuard);
  assert.ok(returnFalse > changedGuard && dispatch > returnFalse);
});

test("shared dispatcher accepts historical replay only with unique purchase source proof", () => {
  const start = appSource.indexOf(
    "const dispatchSignedInPurchaseApplication = async",
  );
  const end = appSource.indexOf(
    "// Signed-in creation never mutates pantry optimistically",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes('persisted.outcome === "already-applied"'));
  assert.ok(block.includes(
    "arePurchaseSourcesVisible(evidence.acceptedSourceIds, pantry)",
  ));
  assert.ok(block.includes(
    'return preservePending ? "retry-pending" : "rejected"',
  ));
  assert.ok(block.includes('return "accepted"'));
});
