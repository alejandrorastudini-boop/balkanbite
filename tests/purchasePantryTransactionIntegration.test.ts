import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("checked-shopping signed-in path uses shared dispatcher without optimistic pantry mutation", () => {
  const start = appSource.indexOf("const handleTransferToPantry");
  const end = appSource.indexOf("const handleReconcileShopping", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);

  assert.ok(handler.includes("const preview = transferCheckedShoppingItems("));
  assert.ok(handler.includes("if (!currentUser)"));
  assert.ok(handler.includes("setPantry(preview.pantry)"));
  assert.ok(handler.includes("dispatchSignedInPurchaseApplication("));
  assert.ok(handler.includes(
    "const acceptedPreviewSources = new Set(preview.acceptedSourceIds)",
  ));
  assert.ok(handler.includes(
    ".filter(purchase => acceptedPreviewSources.has(purchase.sourceId))",
  ));

  const signedInStart = handler.indexOf(
    "} else {",
    handler.indexOf("if (!currentUser)"),
  );
  assert.ok(signedInStart >= 0);
  assert.equal(handler.slice(signedInStart).includes("setPantry("), false);
});

test("shared dispatcher installs exact purchase evidence before transaction dispatch", () => {
  const start = appSource.indexOf(
    "const dispatchSignedInPurchaseApplication = async",
  );
  const end = appSource.indexOf(
    "// Signed-in creation never mutates pantry optimistically",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  const buildId = block.indexOf("buildPurchaseMutationId(purchases)");
  const evidence = block.indexOf("buildPendingPurchaseCommitEvidence(");
  const pending = block.indexOf(
    "pendingSignedInPurchaseApplication.current = evidence",
  );
  const submit = block.indexOf("submitPurchasePantryApplication(");

  assert.ok(buildId >= 0 && evidence > buildId);
  assert.ok(pending > evidence && submit > pending);
});

test("shopping rows and progression finalize only after exact confirmed purchase evidence", () => {
  const start = appSource.indexOf(
    "const finalizeSignedInPurchaseIfVisible",
  );
  const end = appSource.indexOf(
    "const dispatchSignedInPurchaseApplication",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  const proof = block.indexOf(
    "isPurchaseCommitVisible(pending, currentUser.uid, committedPantry)",
  );
  const clear = block.indexOf(
    "pendingSignedInPurchaseApplication.current = null",
    proof,
  );
  const progression = block.indexOf("buildPurchaseProgressEvents(", proof);
  const derived = block.indexOf(
    "submitRecipesReplace(recipes, syncedRecipes)",
    proof,
  );

  assert.ok(proof >= 0);
  assert.ok(clear > proof);
  assert.equal(block.indexOf("setShoppingList(", proof), -1);
  assert.ok(progression > clear);
  assert.ok(derived > progression);
  assert.ok(block.includes("submitMealPlanReplace(mealPlan, newPlan)"));
  assert.ok(block.includes("Shopping rows were retired in the same authoritative purchase transaction"));
});

test("shared dispatcher retains purchase evidence for in-flight/authority gaps and transport uncertainty", () => {
  const start = appSource.indexOf(
    "const dispatchSignedInPurchaseApplication = async",
  );
  const end = appSource.indexOf(
    "// Signed-in creation never mutates pantry optimistically",
    start,
  );
  const block = appSource.slice(start, end);

  assert.ok(block.includes('persisted.reason === "in-flight"'));
  assert.ok(block.includes('persisted.reason === "unverified-authority"'));
  assert.ok(block.includes(
    'return preservePending ? "retry-pending" : "rejected"',
  ));

  const catchIndex = block.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "pendingSignedInPurchaseApplication.current = null",
    ),
    false,
  );
  assert.ok(block.slice(catchIndex).includes('return "retry-pending"'));
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

test("advanced reviewed reconciliation is now transactional for signed-in users", () => {
  const start = appSource.indexOf("const handleReconcileShopping = async");
  const end = appSource.indexOf("const handleLogMeal", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes("reconcileConfirmedShoppingPurchases("));
  assert.ok(block.includes("buildConfirmedShoppingReconciliationInput("));
  assert.ok(block.includes("dispatchSignedInPurchaseApplication("));

  const guestStart = block.indexOf("if (!currentUser)");
  const guestSet = block.indexOf("setPantry(preview.pantry)", guestStart);
  const signedStart = block.indexOf("if (!safeReconciliationId)", guestSet);
  assert.ok(guestStart >= 0 && guestSet > guestStart && signedStart > guestSet);
  assert.equal(block.slice(signedStart).includes("setPantry("), false);
});
