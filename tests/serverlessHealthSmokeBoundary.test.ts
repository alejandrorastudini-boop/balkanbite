import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const smoke = readFileSync(
  new URL("../qa/runtime/serverless-health-smoke.mjs", import.meta.url),
  "utf8",
);

test("CI bundles the real Vercel serverless entrypoint", () => {
  assert.match(workflow, /npx esbuild api\/index\.ts/);
  assert.match(workflow, /--platform=node/);
  assert.match(workflow, /--format=cjs/);
  assert.match(workflow, /--outfile=\/tmp\/balkanbite-api\.cjs/);
});

test("CI executes the serverless health smoke after bundling", () => {
  const bundleIndex = workflow.indexOf("Bundle real serverless entrypoint");
  const smokeIndex = workflow.indexOf("Smoke real serverless cold start");

  assert.ok(bundleIndex >= 0);
  assert.ok(smokeIndex > bundleIndex);
  assert.match(
    workflow,
    /node qa\/runtime\/serverless-health-smoke\.mjs \/tmp\/balkanbite-api\.cjs/,
  );
});

test("serverless smoke invokes the health route through a real local HTTP server", () => {
  assert.match(smoke, /http\.createServer/);
  assert.match(smoke, /VERCEL = "1"/);
  assert.match(smoke, /NODE_ENV = "production"/);
  assert.match(smoke, /\/api\/health/);
  assert.match(smoke, /response\.status,\s*200/);
  assert.match(smoke, /payload\.status, "ok"/);
  assert.match(smoke, /payload\.aiProvider, "openai"/);
  assert.match(smoke, /payload\.aiModel, "gpt-5\.6-luna"/);
});

test("serverless health smoke does not require an OpenAI generation credential", () => {
  assert.match(workflow, /OPENAI_API_KEY: ""/);
  assert.doesNotMatch(smoke, /\/v1\/responses|generateWithOpenAI/);
});
