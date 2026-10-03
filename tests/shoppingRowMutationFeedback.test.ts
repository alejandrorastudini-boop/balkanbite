import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");
const view = fs.readFileSync("src/components/ShoppingView.tsx", "utf8");

test("signed-in shopping row mutations return persistence outcomes without optimistic state", () => {
  const toggle = app.slice(app.indexOf("const handleToggleShoppingItem"), app.indexOf("const handleDeleteShoppingItem"));
  const remove = app.slice(app.indexOf("const handleDeleteShoppingItem"), app.indexOf("const handleAddShoppingItem"));

  assert.match(toggle, /async \(id: string\): Promise<boolean>/);
  assert.match(toggle, /if \(!currentUser\)[\s\S]*setShoppingList[\s\S]*return true;/);
  assert.match(toggle, /await submitShoppingItemReplace\(expected, next\)/);
  assert.match(toggle, /outcome === "needs-review"[\s\S]*return false;/);

  assert.match(remove, /async \(id: string\): Promise<boolean>/);
  assert.match(remove, /if \(!currentUser\)[\s\S]*setShoppingList[\s\S]*return true;/);
  assert.match(remove, /await submitShoppingItemRemove\(expected\)/);
  assert.match(remove, /outcome === "needs-review"[\s\S]*return false;/);
});

test("shopping view blocks concurrent row commands and surfaces retryable failure", () => {
  assert.match(view, /const \[pendingRowMutationId, setPendingRowMutationId\]/);
  assert.match(view, /if \(pendingRowMutationId\) return;/);
  assert.match(view, /const saved = await Promise\.resolve\(mutation\(id\)\)/);
  assert.match(view, /disabled=\{pendingRowMutationId !== null\}/);
  assert.match(view, /role="alert"/);
});

test("signed-in shopping row handlers do not mutate local list outside guest branch", () => {
  const toggle = app.slice(app.indexOf("const handleToggleShoppingItem"), app.indexOf("const handleDeleteShoppingItem"));
  const remove = app.slice(app.indexOf("const handleDeleteShoppingItem"), app.indexOf("const handleAddShoppingItem"));
  const signedToggle = toggle.slice(toggle.indexOf("try {"));
  const signedRemove = remove.slice(remove.indexOf("try {"));
  assert.doesNotMatch(signedToggle, /setShoppingList\(/);
  assert.doesNotMatch(signedRemove, /setShoppingList\(/);
});
