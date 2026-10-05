import assert from "node:assert/strict";

export const EXPECTED_HOSTED_PROJECT = "gen-lang-client-0319723351";
export const EXPECTED_HOSTED_DATABASE =
  "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";
export const EXPECTED_HOSTED_TARGET = "https://balkanbite.vercel.app";
export const HOSTED_RUN_MODES = [
  "disabled",
  "hosted-readonly-preflight",
  "one-time-synthetic-hosted-e2e",
];

export function validateHostedRunRequestShape(request) {
  assert.ok(request && typeof request === "object", "Hosted run request must be an object");
  assert.ok(HOSTED_RUN_MODES.includes(request.mode),
    "Hosted run mode must be disabled, read-only preflight or explicit synthetic E2E");
  assert.equal(request.projectId, EXPECTED_HOSTED_PROJECT);
  assert.equal(request.databaseId, EXPECTED_HOSTED_DATABASE);
  assert.equal(request.targetUrl, EXPECTED_HOSTED_TARGET);

  if (request.mode !== "disabled") {
    assert.match(String(request.productionCommit || ""), /^[a-f0-9]{40}$/,
      "Exact production commit required");
    assert.match(String(request.rulesSha256 || ""), /^[a-f0-9]{64}$/,
      "Exact production Rules SHA required");
  }

  return {
    disabled: request.mode === "disabled",
    writeEnabled: request.mode === "one-time-synthetic-hosted-e2e",
  };
}

export function validateHostedRunBranchComparison(comparison) {
  assert.equal(comparison?.status,"ahead",
    "Hosted run branch must be exactly ahead of Production main");
  assert.equal(comparison?.ahead_by,1,
    "Hosted run branch must contain exactly one reviewed commit");
  assert.equal(comparison?.behind_by,0,
    "Hosted run branch must not be behind Production main");
  assert.deepEqual(
    (comparison?.files || []).map(file=>file.filename),
    ["qa/runtime/hosted-run-request.json"],
    "Hosted run branch may change only the reviewed run manifest",
  );
}
