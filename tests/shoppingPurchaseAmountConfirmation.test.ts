import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const shoppingSource = fs.readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8",
);
const voiceSource = fs.readFileSync(
  new URL("../src/components/VoiceShoppingReconcileModal.tsx", import.meta.url),
  "utf8",
);
const mergeSource = fs.readFileSync(
  new URL("../src/utils/purchasePantryMerge.ts", import.meta.url),
  "utf8",
);

test("AI shopping suggestions remain planning estimates until human confirmation", () => {
  assert.match(appSource, /amountOrigin: "ai_estimated"/);
  assert.match(
    appSource,
    /amountOrigin: "ai_estimated"[\s\S]{0,160}purchaseAmountConfirmed: false/,
  );
  assert.match(
    shoppingSource,
    /item\.amountOrigin === "ai_estimated"/,
  );
  assert.match(shoppingSource, /"AI estimate"/);
  assert.match(shoppingSource, /"Estimación IA"/);
  assert.match(shoppingSource, /"AI оценка"/);
});

test("checking a shopping row explicitly confirms the displayed purchased amount", () => {
  assert.match(
    appSource,
    /const checked = !item\.checked;[\s\S]{0,260}purchaseAmountConfirmed: checked/,
  );
  assert.match(
    shoppingSource,
    /Checking an item confirms that you bought exactly the quantity and unit shown\./,
  );
  assert.match(
    shoppingSource,
    /Marcar un artículo confirma que compraste exactamente la cantidad y unidad mostradas\./,
  );
  assert.match(
    shoppingSource,
    /Confirms the exact displayed purchased amount/,
  );
});

test("pantry transfer independently blocks checked rows lacking confirmation", () => {
  assert.match(
    mergeSource,
    /item\.purchaseAmountConfirmed === true/,
  );
  assert.match(mergeSource, /"unconfirmed_amount"/);
});

test("voice reconciliation never preselects AI-proposed list purchases", () => {
  assert.doesNotMatch(
    voiceSource,
    /setSelectedPurchasedIds\(\s*\(data\.purchasedItemIds/,
  );
  assert.match(
    voiceSource,
    /AI may propose purchased list IDs, but proposal is not confirmation\.[\s\S]{0,220}setSelectedPurchasedIds\(\[\]\)/,
  );
  assert.match(
    voiceSource,
    /Select only if the shown quantity and unit match what you actually bought\./,
  );
});

test("voice purchase confirmation does not render estimated price or hardcoded FX", () => {
  assert.doesNotMatch(voiceSource, /estimatedPriceEUR\.toFixed/);
  assert.doesNotMatch(voiceSource, /estimatedPriceEUR\s*\*\s*1\.1/);
  assert.doesNotMatch(voiceSource, /currency:\s*Currency/);
});
