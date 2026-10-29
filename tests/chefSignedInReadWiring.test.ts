import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sync = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const progression = readFileSync(new URL("../src/utils/progressionFirestore.ts", import.meta.url), "utf8");
const chef = readFileSync(new URL("../src/utils/chefWorkspaceFacts.ts", import.meta.url), "utf8");

test("signed-in Chef uses explicit common server read authority instead of UI hydration", () => {
  assert.match(sync, /const chefServerReadEvidence = useRef/);
  assert.match(sync, /chefServerReadEvidence\.current = \{\}/);
  assert.match(sync, /auth\.currentUser\?\.uid === currentUser\.uid/);
  assert.match(sync, /deriveChefServerCollectionRead\(/);
  assert.match(sync, /selectCompleteChefServerWorkspace\(/);
  assert.match(app, /const confirmed = getServerConfirmedChefWorkspace\(progressionLedger\)/);
  assert.match(app, /return confirmed \? \{ pantry: verifiedPantry, \.\.\.confirmed \} : null/);
  assert.match(app, /const verifiedPantry = getAuthoritativePantryForChef\(\)/);
});

test("metadata transitions and listener errors revoke server-verified Chef facts", () => {
  assert.match(sync, /includeMetadataChanges: collectionName === "inventory" \|\| readScoped/);
  assert.match(sync, /chefServerReadEvidence\.current\[collectionName as "mealPlans" \| "shoppingList"\] =\s*evidence \?\? undefined/);
  assert.match(sync, /chefServerReadEvidence\.current\[collectionName as "mealPlans" \| "shoppingList"\] = undefined/);
  assert.match(progression, /includeMetadataChanges: true/);
  assert.match(progression, /deriveChefServerProgressRead\(/);
  assert.match(progression, /onReadEvidence\?\.\(null\)/);
});

test("signed-in authorization does not change deterministic read-only query semantics", () => {
  assert.match(chef, /evaluateShoppingNeeds\(/);
  assert.match(chef, /summarizeProgressionActivity\(/);
  assert.match(chef, /isValidProgressionEvent\(/);
  assert.match(app, /getAuthoritativeChefWorkspace/);
  assert.doesNotMatch(chef, /writeBatch\(|runTransaction\(|addDoc\(|setDoc\(/);
});
