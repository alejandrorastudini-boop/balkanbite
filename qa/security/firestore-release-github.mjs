import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleAuth } from "google-auth-library";
import {
  PROJECT_ID, DATABASE_ID, RELEASE_NAME, sha256,
  verifyFirebaseTarget, requireReleaseName, getSingleSource,
  isKnownDenyAll, normalizeRules, verifyReleaseRequest, verifyHostedBaseline,
} from "./firestore-release-core.mjs";

const apiRoot = "https://firebaserules.googleapis.com/v1/";
const requestFile = "ops/firebase-rules-release-request.json";
const source = readFileSync("firestore.rules", "utf8");
const firebaseJson = JSON.parse(readFileSync("firebase.json", "utf8"));
const appConfig = JSON.parse(readFileSync("firebase-applet-config.json", "utf8"));
const projectNumber = verifyFirebaseTarget(firebaseJson, appConfig);
const attachmentPoint = "firestore.googleapis.com/projects/" + projectNumber +
  "/databases/" + DATABASE_ID;
const eventName = process.env.GITHUB_EVENT_NAME;
const manifest = eventName === "push"
  ? JSON.parse(readFileSync(requestFile, "utf8"))
  : null;
const mode = eventName === "push"
  ? manifest?.mode
  : (process.env.BB_RELEASE_MODE || "inspect");

assert.ok(mode === "inspect" || mode === "publish", "Invalid release mode");
assert.equal(process.env.GITHUB_REF, "refs/heads/main",
  "Named Firestore operations are restricted to main");
if (mode === "publish") {
  // Even a manually dispatched publish needs an audited request in Git.
  verifyReleaseRequest(
    manifest || JSON.parse(readFileSync(requestFile, "utf8")), source,
  );
}

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/firebase"],
});
const authProjectId = await auth.getProjectId();
assert.equal(authProjectId, PROJECT_ID, "Google credentials belong to another project");
const client = await auth.getClient();

async function api(method, resource, body) {
  const url = apiRoot + resource;
  const response = await client.request({
    method,
    url,
    ...(body === undefined ? {} : { data: body }),
    timeout: 30000,
  });
  return response.data;
}

const release = await api("GET", RELEASE_NAME);
const originalRulesetName = requireReleaseName(release);
const hostedRuleset = await api("GET", originalRulesetName);
const hostedSource = getSingleSource(hostedRuleset);
const currentHash = sha256(hostedSource);
const desiredHash = sha256(normalizeRules(source));

const backupDir = join(process.env.RUNNER_TEMP || "/tmp", "balkanbite-rules-backup");
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const backupPath = join(backupDir, "named-firestore-" +
  (process.env.GITHUB_RUN_ID || "local") + ".json");
writeFileSync(backupPath, JSON.stringify({
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
  release,
  ruleset: hostedRuleset,
  sourceSha256: currentHash,
  desiredSha256: desiredHash,
  gitSha: process.env.GITHUB_SHA || "",
  capturedAt: new Date().toISOString(),
}, null, 2), { mode: 0o600 });

console.log("Named Firestore release:", RELEASE_NAME);
console.log("Hosted ruleset:", originalRulesetName);
console.log("Hosted SHA-256:", currentHash);
console.log("Repository rules SHA-256:", desiredHash);
console.log("Git release-request SHA-256:", sha256(source));
console.log("Backup captured before any mutation.");
if (mode === "inspect") {
  console.log("INSPECT COMPLETE: no rules were modified.");
  process.exit(0);
}

if (normalizeRules(hostedSource) === normalizeRules(source)) {
  console.log("Already up to date: hosted rules exactly match main. No publication needed.");
  process.exit(0);
}

// Require the exact pre-release snapshot recovered by the read-only inspection.
verifyHostedBaseline(
  manifest || JSON.parse(readFileSync(requestFile, "utf8")),
  originalRulesetName,
  currentHash,
);
assert.ok(isKnownDenyAll(hostedSource),
  "Hosted rules are not the expected deny-all baseline. Refusing to overwrite.");

const created = await api("POST", "projects/" + PROJECT_ID + "/rulesets", {
  source: { files: [{ name: "firestore.rules", content: source }] },
  attachment_point: attachmentPoint,
});
assert.match(String(created?.name || ""),
  new RegExp("^projects/" + PROJECT_ID + "/rulesets/[^/]+$"),
  "Created ruleset belongs to an unexpected project");
assert.equal(created.attachment_point || created.attachmentPoint, attachmentPoint,
  "Created ruleset has the wrong attachment point");
console.log("New immutable ruleset created:", created.name);

// Recheck just before publication; avoid knowingly clobbering an intervening release.
const immediatelyBeforePublish = await api("GET", RELEASE_NAME);
assert.equal(requireReleaseName(immediatelyBeforePublish), originalRulesetName,
  "Hosted release changed during the publication preparation");

let changedRelease = false;
try {
  // A new immutable ruleset does not become live until this single named
  // release changes. The default database and other named databases are not touched.
  const updated = await api("PATCH", RELEASE_NAME, {
    release: { name: RELEASE_NAME, rulesetName: created.name },
    updateMask: "rulesetName",
  });
  changedRelease = true;
  requireReleaseName(updated);
  assert.equal(updated.rulesetName, created.name,
    "Named release update did not select the expected ruleset");

  const verify = await api("GET", RELEASE_NAME);
  requireReleaseName(verify);
  assert.equal(verify.rulesetName, created.name,
    "Named release does not reference the published ruleset");
  const verifyRuleset = await api("GET", verify.rulesetName);
  assert.equal(normalizeRules(getSingleSource(verifyRuleset)),
    normalizeRules(source),
    "Published rules source does not exactly match the checked-in file");
  console.log("PUBLISHED AND VERIFIED:", RELEASE_NAME);
  console.log("Rules SHA-256:", desiredHash);
  console.log("Propagation and authenticated E2E still require separate verification.");
} catch (error) {
  console.error("Publication verification failed:", error.message);
  // A PATCH may succeed server-side even if the response is lost. Inspect
  // the live release before deciding whether rollback is safe.
  try {
    const current = await api("GET", RELEASE_NAME);
    const currentRulesetName = requireReleaseName(current);
    if (currentRulesetName === created.name) {
      const restored = await api("PATCH", RELEASE_NAME, {
        release: { name: RELEASE_NAME, rulesetName: originalRulesetName },
        updateMask: "rulesetName",
      });
      requireReleaseName(restored);
      assert.equal(restored.rulesetName, originalRulesetName);
      const confirmedRollback = await api("GET", RELEASE_NAME);
      assert.equal(requireReleaseName(confirmedRollback), originalRulesetName,
        "Rollback returned successfully but live release is not restored");
      console.error("Original release restored and verified:", originalRulesetName);
    } else if (currentRulesetName === originalRulesetName) {
      console.error("Original rules are still live; no rollback needed.");
    } else {
      console.error("CRITICAL: an external ruleset is live. Refusing to overwrite it.");
    }
  } catch (rollbackError) {
    console.error("CRITICAL: could not inspect or restore live release:",
      rollbackError.message);
  }
  throw error;
}
