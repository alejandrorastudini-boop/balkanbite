import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/firestore-rules.yml", import.meta.url), "utf8");

test("read-authority implementation changes must trigger the real Firebase SDK emulator", () => {
  for (const path of [
    "src/utils/chefServerReadAuthority.ts",
    "src/utils/pantryEditIntentCapture.ts",
    "src/utils/progressionFirestore.ts",
    "src/hooks/useFirebaseSync.ts",
    "qa/security/**",
    ".github/workflows/firestore-rules.yml",
  ]) {
    assert.ok(workflow.includes(`- "${path}"`),
      `Firestore Emulator workflow must watch ${path}`);
  }
  assert.match(workflow,
    /node --import tsx qa\/security\/chef-read-authority-emulator\.mjs/,
    "emulator command must exercise the signed-in Chef listener contract");
  assert.match(workflow, /FIRESTORE_EMULATOR_HOST: "127\.0\.0\.1:8080"/);
  assert.match(workflow, /--only firestore/);
  assert.match(workflow, /--project demo-balkanbite-rules/);
});
