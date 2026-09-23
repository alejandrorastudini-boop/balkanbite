import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROJECT_ID, DATABASE_ID, RELEASE_NAME, sha256,
  verifyFirebaseTarget, requireReleaseName, getSingleSource,
  isKnownDenyAll, verifyReleaseRequest, verifyHostedBaseline,
} from "./firestore-release-core.mjs";

const rules = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} { allow read, write: if false; }\n  }\n}\n";

test("the release target is fixed to BalkanBite, never the default or another app", () => {
  assert.ok(RELEASE_NAME.endsWith("/" + DATABASE_ID));
  assert.notEqual(DATABASE_ID, "(default)");
  assert.equal(verifyFirebaseTarget({
    firestore: [{ database: DATABASE_ID, rules: "firestore.rules" }],
  }, { projectId: PROJECT_ID, messagingSenderId: "498382946340" }),
  "498382946340");
  assert.throws(() => verifyFirebaseTarget({
    firestore: [{ database: "(default)", rules: "firestore.rules" }],
  }, { projectId: PROJECT_ID, messagingSenderId: "498382946340" }));
  assert.throws(() => verifyFirebaseTarget({
    firestore: [
      { database: DATABASE_ID, rules: "firestore.rules" },
      { database: "other", rules: "other.rules" },
    ],
  }, { projectId: PROJECT_ID, messagingSenderId: "498382946340" }));
});

test("the existing hosted release must match the exact named database", () => {
  const rulesetName = "projects/" + PROJECT_ID + "/rulesets/123abc";
  assert.equal(requireReleaseName({ name: RELEASE_NAME, rulesetName }), rulesetName);
  assert.throws(() => requireReleaseName({
    name: "projects/" + PROJECT_ID + "/releases/cloud.firestore",
    rulesetName,
  }));
  assert.equal(getSingleSource({ source: { files: [{ content: rules }] } }),
    rules.trim());
  assert.throws(() => getSingleSource({ source: { files: [] } }));
});

test("unattended publication only replaces an unmistakable deny-all source", () => {
  assert.equal(isKnownDenyAll(rules), true);
  assert.equal(isKnownDenyAll(rules.replace("if false", "if true")), false);
  assert.equal(isKnownDenyAll(rules + "\nallow read: if true;"), false);
  assert.equal(isKnownDenyAll(rules.replace(
    "allow read, write: if false;",
    "allow read: if false; allow write: if false;",
  )), false);
});

test("publication requires a request tied to the exact checked-in source", () => {
  const manifest = {
    mode: "publish",
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    rulesSha256: sha256("sample rules\n"),
    expectedHostedRulesSha256: sha256(rules.trim()),
    expectedHostedRulesetName: "projects/" + PROJECT_ID + "/rulesets/inspected-original",
  };
  verifyReleaseRequest(manifest, "sample rules\n");
  verifyHostedBaseline(
    manifest, manifest.expectedHostedRulesetName, manifest.expectedHostedRulesSha256,
  );
  assert.throws(() => verifyHostedBaseline(
    manifest, "projects/" + PROJECT_ID + "/rulesets/unexpected",
    manifest.expectedHostedRulesSha256,
  ));
  assert.throws(() => verifyHostedBaseline(
    manifest, manifest.expectedHostedRulesetName, sha256("unexpected hosted rules"),
  ));
  assert.throws(() => verifyReleaseRequest({
    ...manifest, expectedHostedRulesSha256: "",
  }, "sample rules\n"));

  assert.throws(() => verifyReleaseRequest(manifest, "changed"));
  assert.throws(() => verifyReleaseRequest({
    ...manifest, databaseId: "other",
  }, "sample rules\n"));
  assert.throws(() => verifyReleaseRequest({
    ...manifest, mode: "inspect",
  }, "sample rules\n"));
});
