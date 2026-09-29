import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const pantrySource = readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url),
  "utf8",
);
const confirmSource = readFileSync(
  new URL("../src/components/ConfirmModal.tsx", import.meta.url),
  "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("clear confirmation keeps one stable mutation ID across retry", () => {
  assert.ok(pantrySource.includes(
    "const clearMutationIdRef = useRef<string | null>(null);",
  ));
  assert.ok(pantrySource.includes(
    "if (!clearMutationIdRef.current)",
  ));
  assert.ok(pantrySource.includes(
    "clearMutationIdRef.current = createClearMutationId();",
  ));
  assert.ok(pantrySource.includes(
    "return onClearAll(mutationId);",
  ));

  const modalStart = pantrySource.indexOf("<ConfirmModal");
  const modalEnd = pantrySource.indexOf("/>", modalStart);
  const modal = pantrySource.slice(modalStart, modalEnd);
  assert.ok(modal.includes("clearMutationIdRef.current = null"));
  assert.ok(modal.includes("setShowClearConfirm(false)"));
});

test("generic confirmation modal is async and closes only on non-false result", () => {
  assert.ok(confirmSource.includes(
    "onConfirm: () => void | boolean | Promise<void | boolean>;",
  ));
  assert.ok(confirmSource.includes(
    "const result = await Promise.resolve(onConfirm());",
  ));
  assert.ok(confirmSource.includes(
    "if (result !== false) onClose();",
  ));
  assert.ok(confirmSource.includes("disabled={isConfirming}"));
  assert.ok(confirmSource.includes("if (isConfirming) return;"));
});

test("signed-in clear never optimistically empties pantry", () => {
  const start = appSource.indexOf("const handleClearPantry");
  const end = appSource.indexOf("const handleClearRecipes", start);
  assert.ok(start >= 0 && end > start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes("if (!currentUser)"));
  assert.ok(block.includes("setPantry([])"));
  assert.ok(block.includes("submitPantryClear(mutationId)"));
  assert.ok(block.includes("pendingSignedInPantryClear.current"));

  const signedInStart = block.indexOf("if (!mutationId)");
  assert.ok(signedInStart >= 0);
  assert.equal(
    block.slice(signedInStart).includes("setPantry([])"),
    false,
    "signed-in clear must wait for Firestore",
  );
});

test("clear finalizes derived state only after all reviewed IDs disappear from confirmed pantry", () => {
  const marker = "const pending = pendingSignedInPantryClear.current";
  const start = appSource.indexOf(marker);
  const purchaseStart = appSource.indexOf(
    "const finalizeSignedInPurchaseIfVisible",
    start,
  );
  assert.ok(start >= 0 && purchaseStart > start);
  const effect = appSource.slice(start, purchaseStart);

  assert.ok(effect.includes(
    "if (!inventoryHydrated || !inventoryServerConfirmed) return",
  ));
  assert.ok(effect.includes(
    "pending.clearedItemIds.some(id => visibleIds.has(id))",
  ));
  assert.ok(effect.includes(
    "reconcileCommittedPantryAvailability(pantry, true)",
  ));
});

test("hook captures complete visible server-confirmed pantry once per clear mutation ID", () => {
  const start = syncSource.indexOf("const submitPantryClear");
  const end = syncSource.indexOf("const inventoryHydrated =", start);
  assert.ok(start >= 0 && end > start);
  const block = syncSource.slice(start, end);

  for (const expected of [
    "inventoryServerConfirmedUser !== uid",
    'authority.status !== "verified"',
    "authority.userId !== uid",
    "preparedPantryClears.current.get(mutationId)",
    "authority.observed.length !== pantry.length",
    "visible.quantity !== observed.quantity",
    "visible.unit !== observed.unit",
    "(visible.cookRevision ?? 0) !== observed.cookRevision",
    "preparedPantryClears.current.set(",
    "persistVerifiedPantryClear(db,",
  ]) {
    assert.ok(block.includes(expected), expected);
  }

  const catchIndex = block.indexOf("catch (error)");
  assert.ok(catchIndex >= 0);
  assert.equal(
    block.slice(catchIndex).includes(
      "preparedPantryClears.current.delete(mutationId)",
    ),
    false,
    "uncertain transport failure must keep original clear baseline",
  );
  assert.equal(block.includes("setPantry("), false);
});

test("journal replay after visible clear may close modal without re-clearing new concurrent stock", () => {
  const start = appSource.indexOf("const handleClearPantry");
  const end = appSource.indexOf("const handleClearRecipes", start);
  const block = appSource.slice(start, end);

  assert.ok(block.includes('result.outcome === "already-recorded"'));
  assert.ok(block.includes(
    "result.clearedItemIds.every(id => !visibleIds.has(id))",
  ));
  assert.ok(block.includes("return true;"));
});
