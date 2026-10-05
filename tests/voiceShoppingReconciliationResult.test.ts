import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const shoppingView = fs.readFileSync("src/components/ShoppingView.tsx", "utf8");
const modal = fs.readFileSync("src/components/VoiceShoppingReconcileModal.tsx", "utf8");

test("ShoppingView propagates the authoritative voice reconciliation result", () => {
  assert.match(
    shoppingView,
    /onReconcileShopping\?: \(result: \{[\s\S]*\}\) => boolean \| Promise<boolean>/,
  );
  assert.match(
    shoppingView,
    /onConfirmReconciliation=\{async \(res\) => \{[\s\S]*if \(!onReconcileShopping\) return false;[\s\S]*return onReconcileShopping\(res\)/,
  );
  assert.doesNotMatch(
    shoppingView,
    /onConfirmReconciliation=\{\(res\) => \{[\s\S]*onReconcileShopping\(res\);/,
  );
});

test("voice reconciliation modal closes only after confirmed persistence", () => {
  assert.match(modal, /const saved = await Promise\.resolve\([\s\S]*onConfirmReconciliation/);
  assert.match(modal, /if \(saved\) \{[\s\S]*onClose\(\);[\s\S]*return;/);
  assert.match(modal, /The purchase was not confirmed\. Your review is preserved for a safe retry\./);
});
