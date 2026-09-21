import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(
  new URL("../src/components/VoiceShoppingReconcileModal.tsx", import.meta.url),
  "utf8",
);

test("AI reconciliation proposals never create an implicit confirmation", () => {
  assert.match(modalSource, /setSelectedPurchasedIds\(\[\]\)/);
  assert.match(modalSource, /setSelectedExtraItems\(\[\]\)/);
});

test("final shopping reconciliation requires at least one human selection", () => {
  assert.match(
    modalSource,
    /const hasExplicitConfirmation =\s*selectedPurchasedIds\.length > 0 \|\| selectedExtraItems\.length > 0;/,
  );
  assert.match(
    modalSource,
    /if \(!reconciliationResult \|\| isSaving \|\| !hasExplicitConfirmation\) return;/,
  );
});

test("confirmation button stays disabled for an empty reviewed selection", () => {
  assert.match(
    modalSource,
    /disabled=\{isSaving \|\| !hasExplicitConfirmation\}/,
  );
});

test("only explicitly selected rows cross the reconciliation callback", () => {
  const start = modalSource.indexOf("const handleConfirmAndSave");
  const end = modalSource.indexOf("if (!isOpen)", start);
  const block = modalSource.slice(start, end);

  assert.match(block, /purchasedItemIds: selectedPurchasedIds/);
  assert.match(block, /itemsToAddToPantry: selectedExtraItems/);
  assert.doesNotMatch(block, /reconciliationResult\.purchasedItemIds/);
  assert.doesNotMatch(block, /reconciliationResult\.extraPurchasedItems/);
});
