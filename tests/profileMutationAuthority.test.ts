import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const mutation = readFileSync(new URL("../src/utils/profileMutationFirestore.ts", import.meta.url), "utf8");

test("signed-in profile no longer bulk-writes on arbitrary local state changes", () => {
  assert.doesNotMatch(hook, /\[profile, currentUser, loading, profileHydratedUser\]/);
  assert.match(hook, /submitProfileReplace/);
  assert.match(hook, /profileRevision\.current/);
  assert.match(app, /onUpdateProfile=\{\(upd\) => handleProfileUpdate\(upd\)\}/);
});

test("profile command verifies exact revision and exact sanitized baseline", () => {
  assert.match(mutation, /revision !== expectedRevision/);
  assert.match(mutation, /remoteSignature !== expectedSignature/);
  assert.match(mutation, /profileRevision: revision \+ 1/);
  assert.match(mutation, /runTransaction/);
});

test("signed-in UI profile edits route through explicit profile authority", () => {
  assert.match(app, /const handleProfileUpdate = async/);
  assert.match(app, /await submitProfileReplace\(profile, next\)/);
  assert.match(app, /onUpdateProfile=\{\(upd\) => handleProfileUpdate\(upd\)\}/);
  assert.match(app, /onComplete=\{\(upd\) => \{ void handleProfileUpdate\(upd\); \}\}/);
});
