import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const profileSource = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("app reset no longer clears all origin storage", () => {
  assert.match(appSource, /clearBalkanBiteLocalStorage\(localStorage\)/);
  assert.doesNotMatch(appSource, /localStorage\.clear\(\)/);
});

test("profile reset uses cloud-aware local-only copy", () => {
  assert.match(profileSource, /getLocalResetCopy\(language, user !== null\)/);
  assert.match(profileSource, /localResetCopy\.buttonLabel/);
  assert.match(profileSource, /localResetCopy\.description/);
  assert.match(profileSource, /localResetCopy\.confirmText/);
  assert.doesNotMatch(
    profileSource,
    /confirmText=\{currentText\.yesResetAll\}/,
  );
});
