import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("signed-in Chef AI chat is never read from or written to persistent local storage", () => {
  assert.doesNotMatch(app, /getUserLocalWorkspaceKey/);
  assert.doesNotMatch(app, /localStorage\.getItem\([\s\S]{0,120}balkanbite_chat_messages_user_/);
  assert.doesNotMatch(app, /localStorage\.setItem\([\s\S]{0,120}balkanbite_chat_messages_user_/);
  assert.match(app, /localStorage\.removeItem\(\`balkanbite_chat_messages_user_\$\{currentUser\.uid\}\`\)/);
});

test("signed-in workspace starts Chef AI chat empty instead of promoting a device cache", () => {
  const marker = app.indexOf("Authenticated Chef IA chat can contain health");
  assert.ok(marker >= 0);
  const block = app.slice(marker, marker + 650);
  assert.match(block, /setChatMessages\(\[\]\)/);
});

test("guest Chef AI chat remains explicitly local", () => {
  assert.match(app, /localStorage\.getItem\("balkanbite_chat_messages"\)/);
  assert.match(app, /localStorage\.setItem\([\s\S]{0,80}"balkanbite_chat_messages"/);
});
