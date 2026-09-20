import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/VoiceShoppingReconcileModal.tsx", import.meta.url),
  "utf8",
);

test("failed reconciliation responses stay out of the review step", () => {
  assert.match(source, /if \(!response\.ok\)/);
  assert.match(source, /setAnalysisError\(/);
  assert.match(source, /voice-shopping-analysis-error/);
  assert.match(source, /No changes were made/);

  const responseGuard = source.indexOf("if (!response.ok)");
  const reviewTransition = source.indexOf('setStep("review")');
  assert.ok(responseGuard >= 0);
  assert.ok(reviewTransition > responseGuard);
});

test("failed reconciliation analysis cannot manufacture a confirmation id", () => {
  const responseGuard = source.indexOf("if (!response.ok)");
  const reconciliationId = source.indexOf("reconciliationIdRef.current = `voice-");
  assert.ok(responseGuard >= 0);
  assert.ok(reconciliationId > responseGuard);
});

test("successful extra proposals remain non-authoritative until explicit review", () => {
  assert.match(
    source,
    /Server\/model quantity, unit, price and expiry are never trusted here/,
  );
  assert.match(source, /setSelectedExtraItems\(\[\]\)/);
  assert.match(source, /extractExplicitReconciliationAmount\(/);
});
