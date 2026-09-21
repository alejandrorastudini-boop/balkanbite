import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../src/components/ChefIaModal.tsx", import.meta.url),
  "utf8",
);
const captureSource = readFileSync(
  new URL("../src/utils/safeVoiceShoppingCapture.ts", import.meta.url),
  "utf8",
);

test("ADD_SHOPPING is staged with the other explicit-confirmation item actions", () => {
  assert.match(
    voiceSource,
    /effectiveActionType === "ADD_SHOPPING"/,
  );
  assert.match(
    voiceSource,
    /effectiveActionType === "ADD_SHOPPING"\s*\? "shopping"/,
  );
  assert.match(
    voiceSource,
    /setPendingItems\(effectiveItems\);\s*setPendingAction\(action\);/,
  );
});

test("pending ADD_SHOPPING metadata is not persisted before confirmation", () => {
  assert.match(
    voiceSource,
    /const safeActionMetadata = isPendingItemAction\s*\? \{\}/,
  );
  assert.match(
    voiceSource,
    /effectiveActionType === "ADD_SHOPPING"/,
  );
  assert.match(
    voiceSource,
    /onAddItemsToShoppingList\(confirmedItems\)/,
  );
});

test("new user input discards any unconfirmed shopping extraction", () => {
  const handleSendStart = voiceSource.indexOf(
    "const handleSend = async",
  );
  const requestStart = voiceSource.indexOf(
    'fetch("/api/ai/parse-intent"',
    handleSendStart,
  );
  const preRequest = voiceSource.slice(handleSendStart, requestStart);

  assert.match(preRequest, /setPendingItems\(null\)/);
  assert.match(preRequest, /setPendingAction\(null\)/);
});

test("confirmation routes shopping separately from pantry add/remove", () => {
  const confirmStart = voiceSource.indexOf(
    "const confirmPendingItems",
  );
  const cancelStart = voiceSource.indexOf(
    "const cancelPendingItems",
    confirmStart,
  );
  const confirmBlock = voiceSource.slice(confirmStart, cancelStart);

  assert.match(confirmBlock, /action === "add"/);
  assert.match(confirmBlock, /onAddItemsToPantry\(confirmedItems\)/);
  assert.match(confirmBlock, /action === "remove"/);
  assert.match(confirmBlock, /onDeductItemsFromPantry\(confirmedItems\)/);
  assert.match(
    confirmBlock,
    /onAddItemsToShoppingList\(confirmedItems\)/,
  );
  assert.match(confirmBlock, /Added to the shopping list:/);
});

test("shopping cancellation makes no shopping mutation claim", () => {
  const cancelStart = voiceSource.indexOf(
    "const cancelPendingItems",
  );
  const handleSendStart = voiceSource.indexOf(
    "const handleSend = async",
    cancelStart,
  );
  const cancelBlock = voiceSource.slice(cancelStart, handleSendStart);

  assert.match(
    cancelBlock,
    /Cancelled\. I did not add anything to the shopping list\./,
  );
  assert.doesNotMatch(cancelBlock, /onAddItemsToShoppingList/);
});

test("pending shopping UI states that AI extraction is not yet persisted", () => {
  assert.match(
    voiceSource,
    /Confirm before adding to shopping list/,
  );
  assert.match(
    voiceSource,
    /Nothing has been added to the shopping list yet\./,
  );
  assert.match(
    voiceSource,
    /disabled=\{!pendingItemsAreComplete\}/,
  );
});

test("App defensively rebuilds confirmed voice-shopping rows", () => {
  assert.match(
    appSource,
    /buildConfirmedVoiceShoppingItems\(\s*items \|\| \[\]/,
  );
  assert.match(
    appSource,
    /setShoppingList\(\(prev\) => \[\.\.\.prev, \.\.\.result\.items\]\)/,
  );
  assert.match(
    captureSource,
    /amountOrigin: "user_entered"/,
  );
  assert.match(
    captureSource,
    /purchaseAmountConfirmed: false/,
  );
  assert.match(
    captureSource,
    /checked: false/,
  );
  assert.doesNotMatch(
    captureSource,
    /estimatedPriceEUR:/,
  );
});

test("App rejects the whole confirmed voice-shopping batch if any row fails revalidation", () => {
  const handlerStart = appSource.indexOf(
    "const handleVoiceAddShoppingItems",
  );
  const handlerEnd = appSource.indexOf(
    "const handleVoiceDeductItems",
    handlerStart,
  );
  const handlerBlock = appSource.slice(handlerStart, handlerEnd);

  const rejectedIndex = handlerBlock.indexOf(
    "if (result.rejectedCount > 0)",
  );
  const returnIndex = handlerBlock.indexOf("return;", rejectedIndex);
  const persistIndex = handlerBlock.indexOf(
    "setShoppingList((prev) => [...prev, ...result.items])",
  );

  assert.ok(rejectedIndex >= 0);
  assert.ok(returnIndex > rejectedIndex);
  assert.ok(persistIndex > returnIndex);
});

test("both full Voice and Chef modal wire the confirmed shopping callback", () => {
  const fullVoiceStart = appSource.indexOf('{activeTab === "voice"');
  const fullVoiceEnd = appSource.indexOf(
    '{activeTab === "profile"',
    fullVoiceStart,
  );
  const fullVoiceBlock = appSource.slice(fullVoiceStart, fullVoiceEnd);
  const appModalStart = appSource.indexOf("<ChefIaModal");
  const appModalEnd = appSource.indexOf("/>", appModalStart);
  const appModalBlock = appSource.slice(appModalStart, appModalEnd);

  assert.match(
    fullVoiceBlock,
    /onAddItemsToShoppingList=\{handleVoiceAddShoppingItems\}/,
  );
  assert.match(
    appModalBlock,
    /onAddItemsToShoppingList=\{handleVoiceAddShoppingItems\}/,
  );
  assert.match(
    modalSource,
    /onAddItemsToShoppingList:\s*\(items: any\[\]\) => boolean;/,
  );
  assert.match(
    modalSource,
    /onAddItemsToShoppingList=\{onAddItemsToShoppingList\}/,
  );
});
