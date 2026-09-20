import assert from "node:assert/strict";
import test from "node:test";
import {
  getUserLocalWorkspaceKey,
  parseArrayCache,
} from "../src/utils/localWorkspaceScope";

test("local-only history keys are isolated by authenticated user", () => {
  assert.equal(
    getUserLocalWorkspaceKey("balkanbite_meallogs", "user-1"),
    "balkanbite_meallogs_user_user-1",
  );
  assert.notEqual(
    getUserLocalWorkspaceKey("balkanbite_chat_messages", "user-1"),
    getUserLocalWorkspaceKey("balkanbite_chat_messages", "user-2"),
  );
  assert.equal(
    getUserLocalWorkspaceKey("balkanbite_progression", "user-1"),
    "balkanbite_progression_user_user-1",
  );
});

test("user ids are encoded before becoming local-storage key segments", () => {
  assert.equal(
    getUserLocalWorkspaceKey("balkanbite_meallogs", "a/b"),
    "balkanbite_meallogs_user_a%2Fb",
  );
});

test("array cache parsing rejects malformed or wrong-shaped storage", () => {
  assert.deepEqual(parseArrayCache<number>("[1,2]"), [1, 2]);
  assert.equal(parseArrayCache("not-json"), null);
  assert.equal(parseArrayCache('{"items":[]}'), null);
  assert.equal(parseArrayCache(null), null);
});
