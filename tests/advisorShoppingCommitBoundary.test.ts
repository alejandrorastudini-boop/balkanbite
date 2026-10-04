import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("advisor shortage rows keep deterministic-shortfall provenance without purchase confirmation", () => {
  const start = app.indexOf("const handleAddMultipleShoppingItems");
  const end = app.indexOf("const handleAdaptMenuToPantry", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.match(handler, /amountOrigin: "deterministic_shortfall"/);
  assert.match(handler, /purchaseAmountConfirmed: false/);
});

test("a committed advisor batch cannot be resubmitted before listener reconciliation", () => {
  const start = app.indexOf("const handleAddMultipleShoppingItems");
  const end = app.indexOf("const handleAdaptMenuToPantry", start);
  const handler = app.slice(start, end);
  assert.match(handler, /committedAdvisorBatchFingerprint\.current === fingerprint/);
  assert.match(handler, /committedAdvisorBatchFingerprint\.current = fingerprint/);
  assert.match(handler, /submitShoppingItemsCreate\(newItems\)/);
});

test("advisor batch guard clears only after the derived shortage batch changes", () => {
  const start = app.indexOf("useEffect(() => {\n    const currentFingerprint = buildAdvisorBatchFingerprint");
  const end = app.indexOf("const handleRequestBrowserNotifications", start);
  assert.ok(start >= 0 && end > start);
  const effect = app.slice(start, end);
  assert.match(effect, /currentFingerprint !== committedAdvisorBatchFingerprint\.current/);
  assert.match(effect, /committedAdvisorBatchFingerprint\.current = null/);
  assert.match(effect, /shoppingDiagnostic\.itemsToAddToShoppingList/);
});

test("failed signed-in advisor commits do not mark the batch committed", () => {
  const start = app.indexOf("const handleAddMultipleShoppingItems");
  const end = app.indexOf("const handleAdaptMenuToPantry", start);
  const handler = app.slice(start, end);
  const review = handler.indexOf('if (result.outcome === "needs-review")');
  const commit = handler.indexOf("committedAdvisorBatchFingerprint.current = fingerprint", review);
  assert.ok(review >= 0 && commit > review);
  assert.match(handler.slice(review, commit), /return false/);
});
