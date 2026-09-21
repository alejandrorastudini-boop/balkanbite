import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);

test("voice ADD_ITEMS are staged instead of persisted directly", () => {
  assert.match(source, /setPendingItems\(effectiveItems\)/);
  assert.match(source, /setPendingAction\(action\)/);
  assert.doesNotMatch(source, /onAddItemsToPantry\(effectiveItems\)/);
});

test("voice pantry persistence exists only behind explicit confirmation", () => {
  assert.match(source, /const confirmPendingItems = \(\) =>/);
  assert.match(source, /onAddItemsToPantry\(confirmedItems\)/);
  assert.match(source, /disabled=\{!pendingItemsAreComplete\}/);
  assert.match(source, /Nothing has been saved to the pantry yet\./);
});

test("voice REMOVE_ITEMS are staged instead of deducted directly", () => {
  assert.match(source, /effectiveActionType === "ADD_ITEMS"/);
  assert.match(source, /effectiveActionType === "REMOVE_ITEMS"/);
  assert.match(source, /setPendingAction\(action\)/);
  assert.doesNotMatch(source, /onDeductItemsFromPantry\(effectiveItems\)/);
});

test("confirmed voice mutation dispatches only the reviewed pending action", () => {
  assert.match(
    source,
    /if \(action === "add"\)[\s\S]*onAddItemsToPantry\(confirmedItems\)[\s\S]*else if \(action === "remove"\)[\s\S]*onDeductItemsFromPantry\(confirmedItems\)/
  );
  assert.match(source, /Nothing has been deducted from the pantry yet\./);
});
