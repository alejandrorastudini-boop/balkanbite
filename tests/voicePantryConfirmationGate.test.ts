import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);

test("voice ADD_ITEMS are staged instead of persisted directly", () => {
  assert.match(source, /setPendingPantryItems\(effectiveItems\)/);
  assert.doesNotMatch(source, /onAddItemsToPantry\(effectiveItems\)/);
});

test("voice pantry persistence exists only behind explicit confirmation", () => {
  assert.match(source, /const confirmPendingPantryItems = \(\) =>/);
  assert.match(source, /onAddItemsToPantry\(confirmedItems\)/);
  assert.match(source, /disabled=\{!pendingPantryItemsAreComplete\}/);
  assert.match(source, /Nothing has been saved to the pantry yet\./);
});

test("voice REMOVE_ITEMS are staged instead of deducted directly", () => {
  assert.match(
    source,
    /effectiveActionType === "ADD_ITEMS" \|\| effectiveActionType === "REMOVE_ITEMS"/
  );
  assert.match(source, /setPendingPantryAction\(action\)/);
  assert.doesNotMatch(source, /onDeductItemsFromPantry\(effectiveItems\)/);
});

test("confirmed voice mutation dispatches only the reviewed pending action", () => {
  assert.match(source, /if \(action === "add"\)[\s\S]*onAddItemsToPantry\(confirmedItems\)[\s\S]*else \{\s*onDeductItemsFromPantry\(confirmedItems\)/);
  assert.match(source, /Nothing has been deducted from the pantry yet\./);
});
