import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firebaseSource = readFileSync(
  new URL("../src/lib/firebase.ts", import.meta.url),
  "utf8",
);
const cliConfig = JSON.parse(
  readFileSync(new URL("../firebase.json", import.meta.url), "utf8"),
);
const appConfig = JSON.parse(
  readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"),
);

const EXPECTED_PROJECT_ID = "gen-lang-client-0319723351";
const EXPECTED_DATABASE_ID =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";

test("client and Firebase rules configuration target the same named BalkanBite database", () => {
  assert.equal(appConfig.projectId, EXPECTED_PROJECT_ID);
  const namedDatabaseMatch = firebaseSource.match(
    /export const FIRESTORE_DATABASE_ID = "([^"]+)"/,
  );
  assert.ok(namedDatabaseMatch, "Missing authoritative Firestore database ID");
  assert.equal(namedDatabaseMatch[1], EXPECTED_DATABASE_ID);

  assert.deepEqual(cliConfig.firestore, [
    { database: EXPECTED_DATABASE_ID, rules: "firestore.rules" },
  ]);
});

test("client creates the named Firestore instance with its in-memory cache", () => {
  assert.match(
    firebaseSource,
    /export const db = initializeFirestore\(\s*app,\s*\{\s*localCache:\s*memoryLocalCache\(\),?\s*\},\s*FIRESTORE_DATABASE_ID,?\s*\);/,
  );
  assert.doesNotMatch(firebaseSource, /getFirestore\(app\)/);
  assert.doesNotMatch(firebaseSource, /export const db = initializeFirestore\(app,\s*\{[^}]+\}\);/s);
});

test("Firebase SDK resolves the configured named instance rather than the default one", async () => {
  // Singleton lookups are local: no network calls or hosted rule changes.
  const [{ auth, db, FIRESTORE_DATABASE_ID }, { getFirestore }] =
    await Promise.all([
      import("../src/lib/firebase.ts"),
      import("firebase/firestore"),
    ]);
  assert.equal(FIRESTORE_DATABASE_ID, EXPECTED_DATABASE_ID);
  assert.strictEqual(getFirestore(auth.app, EXPECTED_DATABASE_ID), db);
  assert.notStrictEqual(getFirestore(auth.app), db);
});
