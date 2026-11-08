import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_PROFILE } from "../src/data/initialData";
import {
  guestProfileCacheIsLossless,
  guestProfileCacheMatchesSnapshot,
  parseGuestProfileCache,
} from "../src/utils/profileSyncBoundary";

test("missing, sparse and explicitly valid guest sources remain writable", () => {
  for (const raw of [
    null,
    "{}",
    JSON.stringify(DEFAULT_PROFILE),
    JSON.stringify({ language: "bg", onboardingCompleted: true }),
    JSON.stringify({
      language: "en", allergies: ["QA allergen"],
      healthProfile: {
        version: 1,
        heightCm: { status: "prefer_not_to_say", source: "self_reported" },
        weightKg: { status: "unknown" },
      },
    }),
  ]) {
    assert.equal(guestProfileCacheIsLossless(raw), true, raw ?? "missing");
    const parsed = parseGuestProfileCache(raw) ?? DEFAULT_PROFILE;
    assert.equal(guestProfileCacheMatchesSnapshot(raw, parsed), true);
  }
});

test("unknown or normalized-away legacy profile values cannot be silently overwritten", () => {
  for (const raw of [
    "not-json",
    "null",
    "[]",
    JSON.stringify({ allergies: ["QA allergen", null] }),
    JSON.stringify({ allergies: [" QA allergen ", "QA allergen"] }),
    JSON.stringify({ name: "  QA Person  " }),
    JSON.stringify({ language: "invalid-language" }),
    JSON.stringify({ heightCm: 180 }),
    JSON.stringify({ isProSubscriber: true }),
    JSON.stringify({ arbitraryAllergyMetadata: { note: "keep" } }),
    JSON.stringify({
      healthProfile: {
        version: 1,
        weightKg: { status: "unknown", legacyReason: "user-declined" },
      },
    }),
    JSON.stringify({
      healthProfile: {
        version: 2,
        ageYears: { status: "unknown" },
      },
    }),
    JSON.stringify({
      healthProfile: {
        version: 1,
        weightKg: { status: "known", value: -999, source: "estimated" },
      },
    }),
  ]) {
    assert.equal(guestProfileCacheIsLossless(raw), false, raw);
  }
});

test("known source with stale values fails snapshot equality without inventing a merge", () => {
  const oldRaw = JSON.stringify({
    name: "QA Guest", language: "es", onboardingCompleted: true,
  });
  const expected = parseGuestProfileCache(oldRaw);
  assert.ok(expected);
  assert.equal(guestProfileCacheMatchesSnapshot(oldRaw, expected), true);
  assert.equal(guestProfileCacheMatchesSnapshot(JSON.stringify({
    name: "QA Guest", language: "bg", onboardingCompleted: true,
  }), expected), false);
  assert.equal(guestProfileCacheMatchesSnapshot(JSON.stringify({
    onboardingCompleted: true, name: "QA Guest", language: "es",
  }), expected), true, "JSON field order cannot mark a matching guest stale");
});

test("guest persistence must commit before UI success, warn and isolate signed-in writes", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /const guestProfileCommittedRef = useRef<UserProfile>\(profile\)/);
  assert.match(app, /guestProfileCacheMatchesSnapshot\(originalRaw, guestProfileCommittedRef\.current\)/);
  assert.match(app, /guestProfileCacheIsLossless\(serialized\)/);
  assert.match(app, /if \(localStorage\.getItem\("balkanbite_profile"\) !== serialized\)/);
  assert.match(app, /guestProfileCommittedRef\.current = next;\s*setProfile\(next\);\s*return true;/);
  assert.match(app, /guestProfileReviewRequired\) return;/);
  assert.match(app, /window\.addEventListener\("storage", onExternalGuestProfileChanged\)/);
  assert.match(app, /window\.removeEventListener\("storage", onExternalGuestProfileChanged\)/);
  assert.match(app, /data-testid="guest-profile-review-warning"/);
  const browser = readFileSync(
    new URL("../qa/runtime/guest-pantry-recovery.mjs", import.meta.url), "utf8");
  assert.match(browser, /runGuestProfileSourcePreservation/);
  assert.match(browser, /guest-profile-legacy-raw-preserved-after-reload/);
  assert.match(browser, /guest-profile-valid-no-false-warning/);
});
