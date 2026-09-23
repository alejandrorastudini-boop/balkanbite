import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pantryViewSource = readFileSync(
  new URL("../src/components/PantryView.tsx", import.meta.url),
  "utf8"
);
const translationsSource = readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8"
);

test("pantry scan button includes explicit visible text and badge rather than only a bare icon", () => {
  assert.match(
    pantryViewSource,
    /id="pantry-scan-camera-btn"/,
    "PantryView must include pantry-scan-camera-btn"
  );
  // Must render scanCameraShort or Escanear ticket explicitly visible (not hidden on all/mobile)
  assert.match(
    pantryViewSource,
    /scanCameraShort/,
    "PantryView scan button must render scanCameraShort text"
  );
  assert.match(
    pantryViewSource,
    /scanCameraBadge/,
    "PantryView scan button must render scanCameraBadge"
  );
});

test("pantry scan button provides descriptive tooltip and aria-label", () => {
  assert.match(
    pantryViewSource,
    /title=\{[^}]*scanCameraTooltip[^}]*\}/,
    "PantryView scan button must provide scanCameraTooltip"
  );
  assert.match(
    pantryViewSource,
    /aria-label=\{[^}]*scanCameraBtn[^}]*\}/,
    "PantryView scan button must provide accessible aria-label"
  );
});

test("pantry view includes explicit scanner hint for receipt or fridge capture", () => {
  assert.match(
    pantryViewSource,
    /pantryScanHint/,
    "PantryView must render pantryScanHint"
  );
});

test("pantry empty state offers direct scan action alongside manual addition", () => {
  assert.match(
    pantryViewSource,
    /id="pantry-empty-scan-btn"/,
    "PantryView empty state must provide pantry-empty-scan-btn"
  );
  assert.match(
    pantryViewSource,
    /id="pantry-empty-add-btn"/,
    "PantryView empty state must provide pantry-empty-add-btn"
  );
});

test("translations define descriptive scan strings in es, en, and bg", () => {
  assert.match(translationsSource, /scanCameraShort:\s*"Escanear despensa"/);
  assert.match(translationsSource, /scanCameraShort:\s*"Scan pantry"/);
  assert.match(translationsSource, /scanCameraShort:\s*"Сканирай килер"/);
  assert.match(
    translationsSource,
    /pantryScanHint:\s*"Haz foto a tu ticket de compra, despensa o nevera para añadir ingredientes automáticamente"/
  );
});
