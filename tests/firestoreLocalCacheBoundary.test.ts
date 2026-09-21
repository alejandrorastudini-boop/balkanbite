import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firebaseSource = readFileSync(
  new URL("../src/lib/firebase.ts", import.meta.url),
  "utf8",
);

test("Firestore cache stays memory-only so browser quota is not a critical runtime dependency", () => {
  assert.match(firebaseSource, /memoryLocalCache/);
  assert.match(
    firebaseSource,
    /initializeFirestore\(app, \{[\s\S]*localCache:\s*memoryLocalCache\(\)[\s\S]*\}\)/,
  );
  assert.doesNotMatch(firebaseSource, /persistentLocalCache/);
  assert.doesNotMatch(firebaseSource, /persistentMultipleTabManager/);
});
