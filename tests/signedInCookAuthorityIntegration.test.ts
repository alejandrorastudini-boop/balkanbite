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

test("App freezes reviewed lot evidence with the prepared cook and rejects contradictory retry evidence", () => {
  assert.ok(appSource.includes("lotEvidence?: readonly ConfirmedCookLotEvidence[]"));
  assert.ok(appSource.includes("normalizeCookLotEvidence(prepared.lotEvidence, expectedIds)"));
  assert.ok(appSource.includes("normalizeCookLotEvidence(lotEvidence, expectedIds)"));
  assert.ok(appSource.includes("lotEvidence,\n        confirmation:"));
  assert.ok(appSource.includes("submitConfirmedCook(pantry, prepared.confirmation, prepared.lotEvidence)"));
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

test("retry rejects contradictory lot evidence instead of silently changing replay identity", () => {
  assert.ok(syncSource.includes("normalizeCookLotEvidence(prepared.lotEvidence, expectedIds)"));
  assert.ok(syncSource.includes("normalizeCookLotEvidence(lotEvidence, expectedIds)"));
  assert.ok(syncSource.includes("JSON.stringify(frozenEvidence) !== JSON.stringify(replayEvidence)"));
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

test("RecipeView only requests exact lot evidence through explicit review with an Unknown path", () => {
  const recipeSource = readFileSync(
    new URL("../src/components/RecipeView.tsx", import.meta.url),
    "utf8",
  );
  const modalSource = readFileSync(
    new URL("../src/components/CookLotReviewModal.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(recipeSource.includes("planCookLotEvidenceReview(pantry, confirmation, reviewedOn)"));
  assert.ok(recipeSource.includes('pendingCook?.lotPlan.outcome === "review"'));
  assert.ok(recipeSource.includes("buildCookLotEvidence(pending.lotPlan, selections, pending.reviewedOn)"));
  assert.ok(recipeSource.includes("onCookRecipe(recipe, cookConfirmationId, lotEvidence)"));
  assert.ok(modalSource.includes('value') === false || modalSource.includes('"unknown"'));
  assert.ok(modalSource.includes('selections[prompt.pantryItemId] === "unknown"'));
  assert.equal(modalSource.includes("choices[0]"), false);
});

