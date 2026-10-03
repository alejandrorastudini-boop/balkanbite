import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

const guardedHandlers = [
  "handleAddMultipleShoppingItems",
  "handleAddMissingToShopping",
  "handleToggleShoppingItem",
  "handleDeleteShoppingItem",
  "handleAddShoppingItem",
  "handleClearShoppingList",
  "handleTransferToPantry",
  "handleReconcileShopping",
  "handleVoiceAddShoppingItems",
];

test("signed-in shopping actions cannot use a transitional shopping baseline", () => {
  for (const name of guardedHandlers) {
    const start = app.indexOf(`const ${name}`);
    assert.ok(start >= 0, name);
    const nextHandler = app.indexOf("\n  const handle", start + 10);
    const block = app.slice(start, nextHandler > start ? nextHandler : start + 4000);
    assert.match(
      block,
      /requireWorkspaceAuthority\(shoppingHydrated, "shopping"\)/,
      name,
    );
  }
});

test("shopping reconciliation checks shopping authority before inventory/model reconciliation work", () => {
  const start = app.indexOf("const handleReconcileShopping");
  const block = app.slice(start, start + 1200);
  const authority = block.indexOf('requireWorkspaceAuthority(shoppingHydrated, "shopping")');
  const inventory = block.indexOf("requireAuthoritativeInventory()");
  assert.ok(authority >= 0 && inventory > authority);
});
