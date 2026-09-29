import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8",
);

test("voice pantry mutation callbacks may be asynchronous", () => {
  assert.match(
    source,
    /onAddItemsToPantry: \(items: any\[\]\) => boolean \| Promise<boolean>;/,
  );
  assert.match(
    source,
    /onDeductItemsFromPantry: \(items: any\[\], mutationId\?: string\) => boolean \| Promise<boolean>;/,
  );
  assert.match(
    source,
    /onAddItemsToShoppingList: \(items: any\[\]\) => boolean \| Promise<boolean>;/,
  );
});

test("confirmation text is computed only after awaited mutation result", () => {
  const start = source.indexOf("const confirmPendingItems = async");
  const end = source.indexOf("const cancelPendingItems", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  const awaitIndex = block.indexOf("await Promise.resolve(");
  const textIndex = block.indexOf("const confirmationText");
  assert.ok(awaitIndex >= 0 && textIndex > awaitIndex);
  assert.match(block, /if \(mutationSucceeded\) \{[\s\S]*setPendingItems\(null\)/);
  assert.match(block, /catch \(error\) \{[\s\S]*mutationSucceeded = false;/);
});

test("a pending voice commit cannot be double-confirmed or cancelled mid-write", () => {
  assert.match(
    source,
    /if \(!pendingItems \|\| !pendingItemsAreComplete \|\| !pendingAction \|\| isConfirmingPendingItems\) return;/,
  );
  assert.match(source, /disabled=\{isConfirmingPendingItems\}/);
  assert.match(
    source,
    /disabled=\{!pendingItemsAreComplete \|\| isConfirmingPendingItems\}/,
  );
});

test("voice failure keeps reviewed pending items available for retry", () => {
  const start = source.indexOf("const confirmPendingItems = async");
  const end = source.indexOf("const cancelPendingItems", start);
  const block = source.slice(start, end);
  const successStart = block.indexOf("if (mutationSucceeded)");
  assert.ok(successStart >= 0);
  const afterSuccess = block.slice(successStart);
  assert.match(afterSuccess, /setPendingItems\(null\)/);
  assert.match(afterSuccess, /setPendingAction\(null\)/);
  const beforeSuccess = block.slice(0, successStart);
  assert.doesNotMatch(beforeSuccess, /setPendingItems\(null\)/);
});
