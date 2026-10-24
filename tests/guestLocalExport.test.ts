import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { captureGuestLocalSnapshot, GUEST_EXPORT_KEYS } from "../src/utils/guestLocalExport";

const pantry = '[{"id":"qa","name":"QA Rice","quantity":150,"unit":"g"}]';
const broken = '{ original malformed historical bytes';
const memory = (source: Record<string, string>) => ({
  getItem(key: string) { return Object.hasOwn(source, key) ? source[key] : null; },
});
test("explicit guest archive retains raw source, quarantined bytes and unknown nulls", () => {
  const r = captureGuestLocalSnapshot(memory({
    balkanbite_pantry: pantry,
    balkanbite_pantry_quarantine_v1: broken,
    balkanbite_profile: '{"language":"bg"}',
  }), "2026-10-24T12:00:00.000Z");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.presentKeys, 3);
  const result = JSON.parse(r.content);
  assert.equal(result.format, "balkanbite-guest-raw-export");
  assert.equal(result.version, 1);
  assert.equal(result.scope, "guest-local-only");
  assert.equal(result.consistency, "best-effort-not-atomic-across-tabs");
  assert.equal(result.restoreSupported, false);
  assert.equal(result.values.balkanbite_pantry, pantry);
  assert.equal(result.values.balkanbite_pantry_quarantine_v1, broken);
  assert.equal(result.values.balkanbite_shopping, null);
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
