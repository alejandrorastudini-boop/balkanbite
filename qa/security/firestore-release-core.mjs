import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const PROJECT_ID = "gen-lang-client-0319723351";
export const DATABASE_ID =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
export const RELEASE_NAME =
  "projects/" + PROJECT_ID + "/releases/cloud.firestore/" + DATABASE_ID;

export const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const normalizeRules = (value) => {
  assert.equal(typeof value, "string", "Rules source must be text");
  return value.replace(/\r\n/g, "\n").trim();
};

export function verifyFirebaseTarget(firebaseJson, appConfig) {
  assert.equal(appConfig.projectId, PROJECT_ID, "Firebase project mismatch");
  assert.match(String(appConfig.messagingSenderId), /^[0-9]+$/,
    "Expected Firebase project number in application config");
  assert.deepEqual(firebaseJson.firestore, [{
    database: DATABASE_ID,
    rules: "firestore.rules",
  }], "Firebase CLI config must target only the named BalkanBite database");
  return String(appConfig.messagingSenderId);
}

export function requireReleaseName(release) {
  assert.equal(release?.name, RELEASE_NAME, "Unexpected hosted release");
  assert.match(String(release?.rulesetName || ""),
    new RegExp("^projects/" + PROJECT_ID + "/rulesets/[^/]+$"),
    "Missing or foreign hosted ruleset");
  return release.rulesetName;
}

export function getSingleSource(ruleset) {
  assert.ok(Array.isArray(ruleset?.source?.files),
    "Hosted ruleset has no source files");
  assert.equal(ruleset.source.files.length, 1,
    "Multiple live rule files require separate review");
  return normalizeRules(ruleset.source.files[0].content);
}

// This guard is deliberately strict. An unfamiliar hosted policy must be
// inspected, not overwritten by an unattended GitHub Actions run.
export function isKnownDenyAll(source) {
  const cleaned = normalizeRules(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  if ((cleaned.match(/\ballow\b/g) || []).length !== 1) return false;
  if (/\bfunction\b/.test(cleaned)) return false;
  return /\ballow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/.test(cleaned);
}

export function verifyReleaseRequest(manifest, localSource) {
  assert.equal(manifest?.mode, "publish", "Release request must say publish");
  assert.equal(manifest?.projectId, PROJECT_ID, "Release project mismatch");
  assert.equal(manifest?.databaseId, DATABASE_ID, "Release database mismatch");
  assert.match(String(manifest?.rulesSha256 || ""), /^[a-f0-9]{64}$/,
    "Expected full SHA-256 of firestore.rules");
  assert.equal(manifest.rulesSha256, sha256(localSource),
    "Rules source has changed since the release was requested");
}
