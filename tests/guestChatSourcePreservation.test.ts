import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { guestChatCacheIsLossless } from "../src/utils/chatMessageValidation";

const saved = {
  id: "qa-message-one",
  sender: "user",
  text: "What do I have in my pantry?",
  timestamp: "2026-10-30T10:00:00.000Z",
};

test("missing and fully valid histories permit a first or subsequent save", () => {
  assert.equal(guestChatCacheIsLossless(null), true);
  assert.equal(guestChatCacheIsLossless("[]"), true);
  assert.equal(guestChatCacheIsLossless(JSON.stringify([saved])), true);
  assert.equal(guestChatCacheIsLossless(JSON.stringify([{
    ...saved,
    id: "qa-assistant-one",
    sender: "assistant",
    actionType: "ADD_ITEMS",
    itemsAffected: [{ name: "QA Rice", quantity: 200, unit: "g" }],
  }])), true);
});

test("historical invalid or stripped messages remain unresolved rather than overwritten", () => {
  const unknownSources = [
    "{broken",
    JSON.stringify({ messages: [saved] }),
    JSON.stringify([{ id: "partial-without-content" }]),
    JSON.stringify([saved, { id: "partial-without-content" }]),
    JSON.stringify([saved, saved]),
    JSON.stringify([{ ...saved, actionType: "retired_voice_action" }]),
    JSON.stringify([{ ...saved, unrecognizedHistoricalField: "keep me" }]),
    JSON.stringify([{ ...saved, itemsAffected: [{ name: "Rice", quantity: 0, unit: "g" }] }]),
  ];
  for (const raw of unknownSources) {
    assert.equal(guestChatCacheIsLossless(raw), false, raw);
  }
});

test("hydration writer refuses lossy cache and failed persistence has explicit guest warning", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /if \(!guestChatCacheIsLossless\(previousRaw\) \|\|[\s\S]*?!guestChatCacheIsLossless\(nextRaw\)\)/);
  assert.match(app, /if \(localStorage.getItem\("balkanbite_chat_messages"\) !== nextRaw\)/);
  assert.match(app, /data-testid="guest-chat-review-warning"/);
  assert.match(app, /guestChatReviewRequired\) return;/);
  const runtime = readFileSync(
    new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");
  assert.ok(runtime.includes("runMalformedGuestChatSourcePreservation"));
  assert.ok(runtime.includes("guest-chat-legacy-raw-retained-after-reload"));
});
