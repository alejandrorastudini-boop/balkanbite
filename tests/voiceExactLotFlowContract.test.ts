import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const voice = readFileSync(new URL("../src/components/VoiceChefView.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sync = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("signed-in voice removal opens deterministic lot review only when planner requires it", () => {
  assert.match(voice, /if \(pendingAction !== "remove" \|\| !exactLotReviewEnabled\)/);
  assert.match(voice, /planVoiceLotReview\(pantry, resolved\.deductions, purpose, reviewedOn\)/);
  assert.match(voice, /if \(plan\.outcome === "not-needed"\)/);
  assert.match(voice, /setPendingLotReview\(\{ plan, reviewedOn \}\)/);
});

test("Unknown review result deliberately keeps the existing aggregate writer path", () => {
  assert.match(voice, /built\.outcome === "exact" \? built\.lotEvidence : undefined/);
  assert.match(voice, /buildVoiceLotEvidence/);
});

test("App enables exact voice review only for authenticated users", () => {
  const matches = app.match(/exactLotReviewEnabled=\{Boolean\(currentUser\)\}/g) ?? [];
  assert.equal(matches.length, 2);
});

test("App freezes exact lot evidence with mutation identity and rejects changed replay", () => {
  assert.match(app, /lotEvidenceSignature = JSON\.stringify\(lotEvidence \?\? \[\]\)/);
  assert.match(app, /JSON\.stringify\(plan\.lotEvidence \?\? \[\]\) !== lotEvidenceSignature/);
  assert.match(app, /plan\.lotEvidence/);
});

test("Firebase sync freezes lot evidence before persistence and rejects changed replay", () => {
  assert.match(sync, /evidenceSignature = JSON\.stringify\(lotEvidence \?\? \[\]\)/);
  assert.match(sync, /JSON\.stringify\(prepared\.lotEvidence \?\? \[\]\) !== evidenceSignature/);
  assert.match(sync, /lotEvidence: prepared\.lotEvidence/);
});

test("reviewed date and lot evidence stay frozen together until mutation succeeds", () => {
  assert.match(voice, /pendingLotReview, setPendingLotReview/);
  assert.match(voice, /pendingLotReview\.reviewedOn/);
  assert.match(voice, /setPendingLotReview\(null\)/);
  assert.match(voice, /pendingMutationIdRef\.current = null/);
});
