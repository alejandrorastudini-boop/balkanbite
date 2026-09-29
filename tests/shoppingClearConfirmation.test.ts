import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8",
);

test("shopping clear button opens review instead of deleting immediately", () => {
  const button = source.slice(
    source.indexOf('id="clear-shopping-list-btn"'),
    source.indexOf('id="shopping-purchase-amount-confirmation-note"'),
  );
  assert.match(button, /onClick=\{\(\) => setShowClearConfirm\(true\)\}/);
  assert.doesNotMatch(button, /onClick=\{onClearList\}/);
});

test("shopping clear review uses shared guarded confirmation modal", () => {
  assert.match(source, /<ConfirmModal[\s\S]*isOpen=\{showClearConfirm\}/);
  assert.match(source, /onConfirm=\{\(\) => onClearList\?\.\(\)\}/);
  assert.match(source, /onClose=\{\(\) => setShowClearConfirm\(false\)\}/);
  assert.match(source, /danger/);
});

test("shopping clear confirmation is localized for Bulgaria-first UX", () => {
  assert.match(source, /"Изчистване на списъка\?"/);
  assert.match(source, /"¿Vaciar la lista\?"/);
  assert.match(source, /"Clear shopping list\?"/);
});
