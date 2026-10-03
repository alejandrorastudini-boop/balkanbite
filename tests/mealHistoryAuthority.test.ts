import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const firestore = readFileSync(new URL("../src/utils/mealLogFirestore.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

test("signed-in meal history uses listener-owned cloud authority", () => {
  assert.match(hook, /subscribeMealLogs/);
  assert.match(hook, /appendMealLogAtomically/);
  assert.match(hook, /mealLogsHydratedUser !== uid/);
  assert.match(hook, /reason: "unverified-authority"/);
  assert.match(app, /await submitMealLog\(newLog\)/);
  assert.match(app, /Never promote a device-local meal cache into authenticated authority/);
  assert.doesNotMatch(app, /getUserLocalWorkspaceKey\([\s\S]{0,80}"balkanbite_meallogs"/);
  assert.match(app, /if \(!currentUser\)[\s\S]*setMealLogs/);
});

test("meal append is immutable and exact-id idempotent", () => {
  assert.match(firestore, /runTransaction/);
  assert.match(firestore, /already-applied/);
  assert.match(firestore, /reason: "conflict"/);
  assert.match(firestore, /sanitizeStoredMealLog/);
});

test("free-form voice still cannot manufacture authoritative nutrition", () => {
  assert.match(server, /parsed\.actionType === "MEAL_LOG"[\s\S]*parsed\.mealLog = null/);
  assert.match(server, /do not calculate or invent calories/);
});
