import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROJECT_ID,
  DATABASE_ID,
  verifyReleaseRequest,
} from "./firestore-release-core.mjs";

const manifest = JSON.parse(
  readFileSync("ops/firebase-rules-release-request.json", "utf8"),
);
const source = readFileSync("firestore.rules", "utf8");

assert.equal(manifest?.projectId, PROJECT_ID, "Release project mismatch");
assert.equal(manifest?.databaseId, DATABASE_ID, "Release database mismatch");

if (manifest?.mode === "publish") {
  verifyReleaseRequest(manifest, source);
  console.log("Offline publish request matches exact firestore.rules bytes and fixed target.");
} else {
  assert.equal(manifest?.mode, "inspect", "Release request mode must be inspect or publish");
  assert.deepEqual(
    Object.keys(manifest).sort(),
    ["databaseId", "mode", "projectId"].sort(),
    "Inspect request must not retain stale publish pins",
  );
  console.log("Offline inspect request is read-only and contains no stale publish pins.");
}
