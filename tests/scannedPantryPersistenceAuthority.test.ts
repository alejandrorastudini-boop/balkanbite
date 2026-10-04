import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");
const pantryView = fs.readFileSync("src/components/PantryView.tsx", "utf8");
const scanModal = fs.readFileSync("src/components/ScanModal.tsx", "utf8");

test("signed-in scanned pantry creation returns authoritative persistence outcome", () => {
  assert.match(
    app,
    /const handleAddMultiplePantryItems = async[\s\S]*?: Promise<boolean>[\s\S]*?if \(currentUser\) \{\s*return dispatchSignedInPantryCreations\(newItems\);\s*\}/
  );
});

test("scan modal waits for save confirmation before resetting reviewed candidates", () => {
  assert.match(scanModal, /const handleSaveToPantry = async \(\) =>/);
  assert.match(scanModal, /const saved = await Promise\.resolve\([\s\S]*?onAddItems\(payload/);
  assert.match(scanModal, /if \(!saved\) \{[\s\S]*?return;[\s\S]*?handleResetModal\(\);\s*onClose\(\);/);
  assert.doesNotMatch(
    scanModal,
    /onAddItems\(payload as Array<Omit<PantryItem, "id" \| "addedAt">>\);\s*handleResetModal\(\);\s*onClose\(\);/
  );
});

test("scan modal blocks duplicate save attempts while persistence is pending", () => {
  assert.match(scanModal, /if \(isSaving\) return;/);
  assert.match(scanModal, /disabled=\{selectedCount === 0 \|\| isSaving\}/);
  assert.match(scanModal, /disabled=\{isSaving\} onClick=\{\(\) => \{ if \(isSaving\) return; handleResetModal\(\); onClose\(\); \}\}/);
  assert.match(scanModal, /disabled=\{isSaving\} onClick=\{\(\) => \{ if \(isSaving\) return; setScanMode\(mode\); handleResetModal\(\); \}\}/);
});

test("pantry view propagates the batch persistence result to scan modal", () => {
  assert.match(
    pantryView,
    /onAddMultipleItems\?: \(items: Array<Omit<PantryItem, "id" \| "addedAt">>\) => boolean \| Promise<boolean>;/
  );
  assert.match(pantryView, /if \(onAddMultipleItems\) \{\s*return onAddMultipleItems\(items\);\s*\}/);
});
