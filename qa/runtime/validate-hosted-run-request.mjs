import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import {
  EXPECTED_HOSTED_DATABASE,
  EXPECTED_HOSTED_TARGET,
  validateHostedRunBranchComparison,
  validateHostedRunRequestShape,
} from "./hosted-run-request-core.mjs";

const request = JSON.parse(
  readFileSync(new URL("./hosted-run-request.json", import.meta.url), "utf8"),
);
const expectedDb = EXPECTED_HOSTED_DATABASE;
const target = EXPECTED_HOSTED_TARGET;

assert.match(process.env.GITHUB_REF || "", /^refs\/heads\/qa\/hosted-firestore-run-[A-Za-z0-9._-]+$/,
  "Hosted QA can run only from a dedicated fresh run branch");
const gate=validateHostedRunRequestShape(request);
if (gate.disabled) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,"write_enabled=false\\n");
  console.log("Hosted QA manifest disabled; no hosted verification or writes requested.");
  process.exit(0);
}

const response = await fetch(
  "https://api.github.com/repos/alejandrorastudini-boop/balkanbite/branches/main",
  { headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": "BalkanBite-QA",
    ...(process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {}),
  } },
);
assert.equal(response.status, 200, "Unable to verify current production main SHA");
const currentMain = await response.json();
assert.equal(currentMain.commit?.sha, request.productionCommit,
  "Main advanced after approved QA request; review before running hosted writes");
const runSha=String(process.env.GITHUB_SHA || "");
assert.match(runSha,/^[a-f0-9]{40}$/,"Exact hosted run branch SHA required");
const compareResponse=await fetch(
  "https://api.github.com/repos/alejandrorastudini-boop/balkanbite/compare/" +
    request.productionCommit + "..." + runSha,
  { headers: {
    Accept:"application/vnd.github+json",
    "User-Agent":"BalkanBite-QA",
    ...(process.env.GITHUB_TOKEN ? { Authorization:"Bearer "+process.env.GITHUB_TOKEN } : {}),
  } },
);
assert.equal(compareResponse.status,200,"Unable to verify hosted run branch delta");
const comparison=await compareResponse.json();
validateHostedRunBranchComparison(comparison);

const rulesResponse = await fetch(
  "https://raw.githubusercontent.com/alejandrorastudini-boop/balkanbite/" +
    request.productionCommit + "/firestore.rules",
  { cache: "no-store" },
);
assert.equal(rulesResponse.status, 200, "Unable to recover firestore.rules for approved Production commit");
const rulesBytes = await rulesResponse.text();
const rulesHash = createHash("sha256").update(rulesBytes).digest("hex");
assert.equal(rulesHash, request.rulesSha256,
  "Approved hosted QA Rules SHA does not match exact Production commit");

const health = await fetch(target + "/api/health", { cache: "no-store" });
assert.equal(health.status, 200, "Production health route unavailable");
const healthPayload=await health.json();
assert.equal(healthPayload.status, "ok");
assert.equal(healthPayload.buildCommit, request.productionCommit,
  "Production health identity is not the exact approved main commit");
assert.match(health.headers.get("cache-control") || "", /no-store/i,
  "Production health identity must not be cacheable");

const writeEnabled=gate.writeEnabled;
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT,"write_enabled="+String(writeEnabled)+"\\n");
}
console.log(writeEnabled
  ? "Hosted QA write manifest, exact Production commit/Rules and target verified."
  : "READ-ONLY PREFLIGHT COMPLETE: exact Production commit/Rules and target verified; hosted writes disabled.");
