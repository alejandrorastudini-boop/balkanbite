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
const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);
const typesSource = readFileSync(
  new URL("../src/types.ts", import.meta.url),
  "utf8",
);

test("guest and user-scoped chat hydration use the domain parser", () => {
  const start = appSource.indexOf("const [chatMessages, setChatMessages]");
  const end = appSource.indexOf("const [progressionLedger", start);
  assert.ok(start >= 0 && end > start);

  const initializer = appSource.slice(start, end);
  assert.match(initializer, /parseChatMessageCache/);
  assert.doesNotMatch(initializer, /JSON\.parse/);

  assert.match(
    appSource,
    /parseChatMessageCache\(\s*localStorage\.getItem\(\s*getUserLocalWorkspaceKey\(\s*"balkanbite_chat_messages"/,
  );
  assert.match(
    appSource,
    /parseChatMessageCache\(localStorage\.getItem\("balkanbite_chat_messages"\)\)/,
  );
  assert.doesNotMatch(appSource, /parseArrayCache<ChatMessage>/);
});

test("new assistant messages sanitize action metadata before persistence", () => {
  assert.match(
    voiceSource,
    /sanitizeChatActionMetadata\(effectiveActionType, effectiveItems\)/,
  );
  assert.match(
    voiceSource,
    /const safeActionMetadata = isPendingPantryMutation[\s\S]*sanitizeChatActionMetadata/,
  );
  assert.match(
    voiceSource,
    /const aiMsg: ChatMessage = \{[\s\S]*\.\.\.safeActionMetadata/,
  );

  const aiMessageStart = voiceSource.indexOf("const aiMsg: ChatMessage");
  const aiMessageEnd = voiceSource.indexOf(
    "onUpdateChatMessages((prev) => [...prev, aiMsg])",
    aiMessageStart,
  );
  const aiMessageBlock = voiceSource.slice(aiMessageStart, aiMessageEnd);
  assert.doesNotMatch(aiMessageBlock, /actionType:\s*effectiveActionType/);
  assert.doesNotMatch(aiMessageBlock, /itemsAffected:\s*effectiveItems/);
});

test("new assistant text ignores non-string model feedback", () => {
  assert.match(
    voiceSource,
    /typeof data\.spokenFeedback === "string" && data\.spokenFeedback\.trim\(\)/,
  );
  assert.match(
    voiceSource,
    /typeof data\.message === "string" && data\.message\.trim\(\)/,
  );
});

test("chat item metadata uses neutral labels instead of claiming a mutation happened", () => {
  assert.match(voiceSource, /getAffectedItemsLabel\(msg\.actionType\)/);
  assert.match(voiceSource, /Detected for pantry addition:/);
  assert.match(voiceSource, /Detected for pantry deduction:/);
  assert.match(voiceSource, /Detected for shopping list:/);
  assert.doesNotMatch(voiceSource, /✓ Added to pantry:/);
  assert.doesNotMatch(voiceSource, /✓ Deducted:/);
});

test("recent AI conversation context is derived from sanitized chat state only", () => {
  assert.match(
    voiceSource,
    /conversationHistory:\s*chatMessages\.slice\(-6\)\.map\(\(m\) => \(\{ sender: m\.sender, text: m\.text \}\)\)/,
  );
});

test("TypeScript action contract matches the six active server prompt values", () => {
  const actions = [
    "MEAL_LOG",
    "RECIPE_RECOMMENDATION",
    "ADD_ITEMS",
    "REMOVE_ITEMS",
    "ADD_SHOPPING",
    "ANSWER",
  ];

  for (const action of actions) {
    assert.match(typesSource, new RegExp(`\\| "${action}"`));
    assert.match(serverSource, new RegExp(`"${action}"`));
  }

  for (const stale of [
    "pantry_update",
    "shopping_list_add",
    "recipe_suggest",
    "meal_log",
  ]) {
    const chatTypeStart = typesSource.indexOf("export type ChatActionType");
    const chatTypeEnd = typesSource.indexOf("export interface ChatMessage", chatTypeStart);
    assert.doesNotMatch(
      typesSource.slice(chatTypeStart, chatTypeEnd),
      new RegExp(stale),
    );
  }
});
