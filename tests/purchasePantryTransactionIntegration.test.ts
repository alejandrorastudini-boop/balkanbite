import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("signed-in checked-shopping transfer never optimistically mutates pantry", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);

  assert.ok(handler.includes("const preview = transferCheckedShoppingItems("));
  assert.ok(handler.includes("if (!currentUser)"));
  assert.ok(handler.includes("setPantry(preview.pantry)"));
  assert.ok(handler.includes("submitPurchasePantryApplication("));

  const signedInStart = handler.indexOf("} else {", handler.indexOf("if (!currentUser)"));
  assert.ok(signedInStart >= 0);
  assert.equal(
    handler.slice(signedInStart).includes("setPantry("),
    false,
    "signed-in transfer must wait for Firestore snapshot",
  );
});

test("purchase evidence is installed before transaction dispatch", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  const handler = appSource.slice(start, end);

  const pending = handler.indexOf(
    "pendingSignedInPurchaseApplication.current = evidence",
  );
  const submit = handler.indexOf("submitPurchasePantryApplication(");
  assert.ok(pending >= 0 && submit > pending);
  assert.ok(handler.includes("buildPurchaseMutationId(purchases)"));
  assert.ok(handler.includes("buildPendingPurchaseCommitEvidence("));
  assert.ok(handler.includes(
    "const acceptedPreviewSources = new Set(preview.acceptedSourceIds)",
  ));
  assert.ok(handler.includes(
    ".filter(purchase => acceptedPreviewSources.has(purchase.sourceId))",
  ));
});

test("shopping rows and progression finalize only after source-history proof in confirmed pantry", () => {
  const finalizeStart = appSource.indexOf(
    "const finalizeSignedInPurchaseIfVisible",
  );
  const creationEffect = appSource.indexOf(
    "// Signed-in creation never mutates pantry optimistically",
    finalizeStart,
  );
  assert.ok(finalizeStart >= 0 && creationEffect > finalizeStart);
  const block = appSource.slice(finalizeStart, creationEffect);

  const proof = block.indexOf(
    "isPurchaseCommitVisible(pending, currentUser.uid, committedPantry)",
  );
  const clear = block.indexOf(
    "pendingSignedInPurchaseApplication.current = null",
    proof,
  );
  const removeShopping = block.indexOf("setShoppingList(", proof);
  const progression = block.indexOf("buildPurchaseProgressEvents(", proof);
  const derived = block.indexOf(
    "reconcilePantryDerivedState(committedPantry, true)",
    proof,
  );

  assert.ok(proof >= 0);
  assert.ok(clear > proof);
  assert.ok(removeShopping > proof);
  assert.ok(progression > removeShopping);
  assert.ok(derived > progression);
  assert.ok(block.includes("accepted.has(`shopping:${item.id}`)"));
});

test("transient authority/in-flight state retains purchase evidence for idempotent retry", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  const handler = appSource.slice(start, end);
  assert.ok(handler.includes('persisted.reason === "in-flight"'));
  assert.ok(handler.includes('persisted.reason === "unverified-authority"'));

  const catchIndex = handler.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    handler.slice(catchIndex).includes(
      "pendingSignedInPurchaseApplication.current = null",
    ),
    false,
    "uncertain network failure must keep evidence until snapshot/retry",
  );
});

test("hook purchase writer requires full server-confirmed visible pantry baseline", () => {
  const start = syncSource.indexOf("const submitPurchasePantryApplication");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const block = syncSource.slice(start, end);

  for (const expected of [
    "inventoryServerConfirmedUser !== uid",
    'authority.status !== "verified"',
    "authority.userId !== uid",
    "authority.observed.length !== pantry.length",
    "visible.quantity !== observed.quantity",
    "visible.unit !== observed.unit",
    "(visible.cookRevision ?? 0) !== observed.cookRevision",
    "persistPurchasesIntoPantryAtomically(db,",
  ]) {
    assert.ok(block.includes(expected), expected);
  }
  assert.equal(block.includes("setPantry("), false);
});

test("advanced shopping reconciliation remains explicitly unmigrated", () => {
  const start = appSource.indexOf("const handleReconcileShopping");
  const end = appSource.indexOf("const handleLogMeal", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);
  assert.ok(block.includes("reconcileConfirmedShoppingPurchases("));
  assert.ok(block.includes("setPantry(result.pantry)"));
  assert.equal(block.includes("submitPurchasePantryApplication("), false);
});
