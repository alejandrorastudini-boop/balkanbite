import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/ProfileView.tsx", "utf8");

test("profile preference writes await persistence before destructive UI cleanup", () => {
  assert.match(source, /const persistPreference = async/);
  assert.match(source, /const persisted = await onUpdateProfile\(update\)/);
  assert.match(source, /if \(persisted === false\)/);
  assert.match(source, /if \(await persistPreference\(\{ disliked: updated \}\)\) \{\s*setNewDislike\(""/);
  assert.doesNotMatch(source, /onUpdateProfile\(\{ disliked: updated \}\);\s*setNewDislike\(""/);
});

test("diet and cooking preference commands are serialized and retryable", () => {
  assert.match(source, /disabled=\{isSavingPreference\} onClick=\{\(\) => void persistPreference\(\{ cookingSpeed:/);
  assert.match(source, /disabled=\{isSavingPreference\} onClick=\{\(\) => void persistPreference\(\{ dietStyle:/);
  assert.match(source, /role="alert"/);
});

test("legacy food-safety cleanup closes only after confirmed profile persistence", () => {
  const start = source.indexOf("isOpen={showClearLegacyFoodSafetyConfirm}");
  const end = source.indexOf('title={', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /onConfirm=\{async \(\) =>/);
  assert.match(block, /const persisted = await persistPreference/);
  assert.match(block, /if \(!persisted\) return false/);
  assert.match(block, /setShowClearLegacyFoodSafetyConfirm\(false\)/);
});
