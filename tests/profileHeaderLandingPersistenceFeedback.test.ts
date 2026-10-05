import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("header and landing profile preference changes consume authoritative result", () => {
  assert.match(app, /const handleProfilePreferenceUpdate = async/);
  assert.match(app, /const saved = await handleProfileUpdate\(update\)/);
  assert.match(app, /if \(!saved\)[\s\S]*El cambio no se ha guardado/);
  assert.match(app, /No se pudo confirmar el cambio/);
  assert.doesNotMatch(app, /void handleProfileUpdate\(\{ language: lang \}\)/);
  assert.doesNotMatch(app, /void handleProfileUpdate\(\{ currency: curr \}\)/);
  assert.match(app, /void handleProfilePreferenceUpdate\(\{ language: lang \}\)/);
  assert.match(app, /void handleProfilePreferenceUpdate\(\{ currency: curr \}\)/);
});

test("signed-in profile update remains listener-authoritative", () => {
  const start = app.indexOf("const handleProfileUpdate");
  const end = app.indexOf("const handleProfilePreferenceUpdate", start);
  const block = app.slice(start, end);
  const signedIn = block.slice(block.indexOf("if (!profileHydrated)"));
  assert.match(signedIn, /await submitProfileReplace\(profile, next\)/);
  assert.doesNotMatch(signedIn, /setProfile\(next\)/);
});
