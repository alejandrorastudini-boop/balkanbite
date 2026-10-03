import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/components/ProfileView.tsx", "utf8");

test("ordinary profile preferences await persistence and preserve retryable failure", () => {
  assert.match(source, /const persistPreferenceUpdate = async/);
  assert.match(source, /if \(preferenceMutationPending\) return false/);
  assert.match(source, /await Promise\.resolve\(onUpdateProfile\(update\)\)/);
  assert.match(source, /if \(persisted === false\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /disabled=\{preferenceMutationPending\}[\s\S]{0,100}persistPreferenceUpdate\(\{ cookingSpeed/);
  assert.match(source, /disabled=\{preferenceMutationPending\}[\s\S]{0,100}persistPreferenceUpdate\(\{ dietStyle/);
});

test("dislike draft clears only after persistence succeeds", () => {
  const start = source.indexOf("const handleAddDislike = async");
  const end = source.indexOf("const handleRemoveDislike", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /await persistPreferenceUpdate\(\{ disliked: updated \}\)/);
  assert.match(block, /setNewDislike\(""/);
});
