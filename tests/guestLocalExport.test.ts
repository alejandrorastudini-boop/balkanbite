import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { captureGuestLocalSnapshot, GUEST_EXPORT_KEYS } from "../src/utils/guestLocalExport";
import { GUEST_VOICE_RECEIPTS_KEY } from "../src/utils/guestVoiceRemovalIntent";

const pantry = '[{"id":"qa","name":"QA Rice","quantity":150,"unit":"g"}]';
const broken = '{ original malformed historical bytes';
const voiceReceipts = '[{"version":1,"mutationId":"qa-voice-use-01","purpose":"food-use","items":[{"name":"QA Rice","quantity":100,"unit":"g"}]}]';
const memory = (source: Record<string, string>) => ({
  getItem(key: string) { return Object.hasOwn(source, key) ? source[key] : null; },
});
test("explicit guest archive retains raw source, quarantined bytes and unknown nulls", () => {
  const r = captureGuestLocalSnapshot(memory({
    balkanbite_pantry: pantry,
    balkanbite_pantry_quarantine_v1: broken,
    balkanbite_profile: '{"language":"bg"}',
    [GUEST_VOICE_RECEIPTS_KEY]: voiceReceipts,
  }), "2026-10-24T12:00:00.000Z");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.presentKeys, 4);
  const result = JSON.parse(r.content);
  assert.equal(result.format, "balkanbite-guest-raw-export");
  assert.equal(result.version, 1);
  assert.equal(result.scope, "guest-local-only");
  assert.equal(result.consistency, "best-effort-not-atomic-across-tabs");
  assert.equal(result.restoreSupported, false);
  assert.equal(result.values.balkanbite_pantry, pantry);
  assert.equal(result.values.balkanbite_pantry_quarantine_v1, broken);
  assert.equal(result.values.balkanbite_shopping, null);
  assert.ok(GUEST_EXPORT_KEYS.includes(GUEST_VOICE_RECEIPTS_KEY));
  assert.equal(result.values[GUEST_VOICE_RECEIPTS_KEY], voiceReceipts);
  assert.deepEqual(Object.keys(result.values), [...GUEST_EXPORT_KEYS]);
});
test("read errors, changes between passes and completely absent local data fail closed", () => {
  assert.deepEqual(captureGuestLocalSnapshot({ getItem() { throw new Error("restricted"); } }, "t"),
    { ok: false, reason: "unavailable" });
  let n = 0;
  const unstable = { getItem(key: string) {
    if (key !== "balkanbite_pantry") return null;
    return ++n === 1 ? pantry : "changed by another tab";
  }};
  assert.deepEqual(captureGuestLocalSnapshot(unstable, "t"),
    { ok: false, reason: "changed-during-read" });
  assert.deepEqual(captureGuestLocalSnapshot(memory({}), "t"),
    { ok: false, reason: "no-data" });
});
test("download is guest-scoped, explicit, read-only, and never advertises restore", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../src/components/ProfileView.tsx", import.meta.url), "utf8");
  assert.match(app, /currentUser \|\| firebaseLoading \|\| isResetting \|\|/);
  assert.match(app, /workspaceScope !== "guest" \|\| pantryScope !== "guest"/);
  assert.match(app, /onExportGuestData=\{!currentUser/);
  assert.match(profile, /data-testid="guest-local-export-button"/);
  assert.match(profile, /automatic restore is not available/);
  assert.doesNotMatch(profile, /\bonImportGuestData\b/);
});

test("guest raw voice receipts remain available and fail closed on concurrent changes", () => {
  const old = '[{"version":1,"mutationId":"qa-voice","purpose":"discard","items":[{"name":"QA Rice","quantity":10,"unit":"g"}]}]';
  const snap = captureGuestLocalSnapshot(memory({ [GUEST_VOICE_RECEIPTS_KEY]: old }), "2026-10-24T13:00:00.000Z");
  assert.equal(snap.ok, true);
  if (snap.ok) assert.equal(JSON.parse(snap.content).values[GUEST_VOICE_RECEIPTS_KEY], old);
  let reads = 0;
  assert.deepEqual(captureGuestLocalSnapshot({ getItem(k: string) {
    if (k === GUEST_VOICE_RECEIPTS_KEY) return ++reads === 1 ? old : "[]";
    return null;
  } }, "t"), { ok: false, reason: "changed-during-read" });
});
