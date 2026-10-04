import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("stable reviewed cook confirmation id reaches App", () => {
  assert.ok(appSource.includes("cookConfirmationId: string"));
  assert.ok(appSource.includes("preparedSignedInCooks.current.get(cookConfirmationId)"));
  assert.ok(appSource.includes("preparedSignedInCooks.current.set(cookConfirmationId, prepared)"));
});

test("signed-in cook does not optimistically set pantry", () => {
  const start = appSource.indexOf("const handleCookRecipe = async");
  const end = appSource.indexOf("const handleAddMissingToShopping", start);
  const handler = appSource.slice(start, end);
  const signedStart = handler.indexOf("let prepared = preparedSignedInCooks");
  assert.ok(signedStart > 0);
  assert.equal(handler.slice(signedStart).includes("setPantry("), false);
  assert.ok(handler.slice(signedStart).includes("await submitConfirmedCook"));
});

test("uncertain retry preserves exact prepared Firestore request", () => {
  assert.ok(syncSource.includes("preparedCookConfirmations.current.get(cookId)"));
  assert.ok(syncSource.includes("persistConfirmedCookAtomically"));
  assert.ok(syncSource.includes("Preserve the exact request"));
});

test("acceptance requires server-confirmed quantity and revision evidence", () => {
  assert.ok(syncSource.includes("inventoryServerConfirmedUser !== uid"));
  assert.ok(syncSource.includes("observed.quantity !== remaining"));
  assert.ok(syncSource.includes("observed.cookRevision !== expected.cookRevision + 1"));
  assert.ok(syncSource.includes("preparedCookConfirmations.current.delete(cookId)"));
});


test("physical lot evidence is replay-bound and only explicit evidence activates exact lot mutation", () => {
  const firestoreSource = readFileSync(
    new URL("../src/utils/confirmedCookFirestore.ts", import.meta.url),
    "utf8",
  );
  assert.ok(firestoreSource.includes("lotEvidence?: readonly ConfirmedCookLotEvidence[]"));
  assert.ok(firestoreSource.includes("cookAllocationSignature(confirmation, normalizedExpected, request.lotEvidence)"));
  assert.ok(firestoreSource.includes("lotEvidence: normalizedLotEvidence"));
  assert.ok(firestoreSource.includes("version: 3"));
  assert.ok(firestoreSource.includes("applyConfirmedInventoryLotDeduction("));
  assert.ok(firestoreSource.includes("const evidence = lotEvidenceById.get(expected.pantryItemId)"));
  assert.ok(firestoreSource.includes("lotState: hasExactLotEvidence"));
  assert.ok(
    firestoreSource.includes(": { version: 1, unallocatedQuantity: quantity, activeLots: [] }"),
    "absence of physical evidence must retain conservative aggregate-collapse behavior",
  );
});


test("signed-in cook derives server-confirmation target from the same unit-safe transaction engine", () => {
  assert.ok(syncSource.includes("const preview = confirmCookTransaction("));
  assert.ok(syncSource.includes("expectedRemaining.set(item.id, item.quantity)"));
  assert.equal(syncSource.includes("observed.quantity - consumed"), false);
});


test("reviewed physical lot evidence is carried unchanged through the signed-in cook boundary", () => {
  assert.ok(syncSource.includes("normalizeCookLotEvidence("));
  assert.ok(syncSource.includes("lotEvidence: normalizedLotEvidence"));
  assert.ok(syncSource.includes("{ lotEvidence: prepared.lotEvidence }"));
  assert.ok(
    syncSource.includes("JSON.stringify(prepared.lotEvidence) !== JSON.stringify(normalizedLotEvidence)"),
    "a retry may not silently replace the physical lot evidence bound to a cook id",
  );
});
