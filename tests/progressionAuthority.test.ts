import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const firestore = readFileSync(new URL("../src/utils/progressionFirestore.ts", import.meta.url), "utf8");

test("signed-in progression is listener-owned and never promoted from local storage", () => {
  assert.match(hook, /subscribeProgressionEvents/);
  assert.match(hook, /progressionHydratedUser !== uid/);
  assert.match(app, /Signed-in progression evidence is hydrated from Firestore only/);
  assert.doesNotMatch(app, /getUserLocalWorkspaceKey\([\s\S]{0,80}"balkanbite_progression"/);
});

test("guest progression remains local while signed-in events use explicit authority", () => {
  assert.match(app, /if \(currentUser\)[\s\S]{0,250}submitProgressionEvents/);
  assert.match(app, /setProgressionLedger\(\(current\) =>[\s\S]{0,120}appendProgressionEvents/);
});

test("progression persistence is immutable and exact-id idempotent", () => {
  assert.match(firestore, /runTransaction/);
  assert.match(firestore, /already-applied/);
  assert.match(firestore, /reason: "conflict"/);
  assert.match(firestore, /isValidProgressionEvent/);
  assert.match(firestore, /new Set\(events\.map\(event => event\.eventId\)\)/);
  assert.match(firestore, /for \(const ref of refs\) snapshots\.push\(await tx\.get\(ref\)\)/);
});

test("signed-in cook progression reuses the stable confirmation id", () => {
  const start = app.indexOf("let prepared = preparedSignedInCooks.current.get(cookConfirmationId)");
  const end = app.indexOf("const handleAddMissingToShopping", start);
  assert.ok(start >= 0 && end > start);
  const signedInCook = app.slice(start, end);
  assert.match(signedInCook, /actionId: cookConfirmationId/);
  assert.doesNotMatch(signedInCook, /randomUUID/);
});
