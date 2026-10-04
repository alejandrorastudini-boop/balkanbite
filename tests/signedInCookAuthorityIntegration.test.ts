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


test("future physical lot evidence is part of immutable cook replay identity while aggregate writer remains conservative", () => {
  const firestoreSource = readFileSync(
    new URL("../src/utils/confirmedCookFirestore.ts", import.meta.url),
    "utf8",
  );
  assert.ok(firestoreSource.includes("lotEvidence?: readonly ConfirmedCookLotEvidence[]"));
  assert.ok(firestoreSource.includes("cookAllocationSignature(confirmation, normalizedExpected, request.lotEvidence)"));
  assert.ok(firestoreSource.includes("lotEvidence: normalizedLotEvidence"));
  assert.ok(firestoreSource.includes("version: 3"));
  assert.ok(
    firestoreSource.includes("writers deliberately remain aggregate-only until an explicit"),
  );
  assert.equal(
    firestoreSource.includes("applyConfirmedInventoryLotDeduction("),
    false,
    "signature support must not silently activate physical lot mutation",
  );
});
