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

test("legacy food-safety deletion keeps confirmation open when persistence fails", () => {
  const start = source.indexOf("isOpen={showClearLegacyFoodSafetyConfirm}");
  const end = source.indexOf('title={', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /onConfirm=\{async \(\) =>/);
  assert.match(block, /const persisted = await onUpdateProfile/);
  assert.match(block, /if \(persisted === false\) return false/);
  assert.match(block, /setShowClearLegacyFoodSafetyConfirm\(false\)/);
});

test("progression storage copy distinguishes signed-in cloud authority from guest local storage", () => {
  assert.doesNotMatch(source, /no se sincroniza con tu cuenta/);
  assert.doesNotMatch(source, /not synced to your account/);
  assert.match(source, /Con la sesión iniciada, este historial verificado se sincroniza con tu cuenta desde la nube/);
  assert.match(source, /Como invitado, este historial se guarda solo en este dispositivo/);
});
