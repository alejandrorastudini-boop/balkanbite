import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("auth transition batch clears signed-in cloud-backed history before account render", () => {
  const start = hook.indexOf("if (shouldClearCloudBackedLocalState)");
  assert.ok(start >= 0);
  const block = hook.slice(start, start + 300);
  for (const setter of ["setRecipes([])", "setMealPlan([])", "setShoppingList([])", "setMealLogs([])", "setProgressionLedger([])"]) {
    assert.ok(block.includes(setter), setter);
  }
});

test("Chef AI never renders guest chat while signed-in workspace scope is switching", () => {
  assert.match(app, /const visibleChatMessages =\s*currentUser && workspaceScope !== currentUser\.uid \? \[\] : chatMessages/);
  const directProps = app.match(/chatMessages=\{chatMessages\}/g) ?? [];
  assert.equal(directProps.length, 0);
  const scopedProps = app.match(/chatMessages=\{visibleChatMessages\}/g) ?? [];
  assert.ok(scopedProps.length >= 2);
});
