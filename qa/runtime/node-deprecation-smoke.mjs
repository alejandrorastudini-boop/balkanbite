import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Each request gets a cold process: Node only emits DEP0169 once per process.
const bundleArg = process.argv[2];
const mode = process.argv[3] === "--worker" ? process.argv[4] : null;
const expectAbsoluteWarning = process.argv.includes("--expect-absolute-warning");
assert.ok(bundleArg, "Usage: node qa/runtime/node-deprecation-smoke.mjs <api-bundle> [--expect-absolute-warning]");

if (!mode) {
  for (const requestMode of ["origin", "query", "absolute"]) {
    const result = spawnSync(process.execPath, [
      "--pending-deprecation", "--trace-deprecation", "--enable-source-maps",
      fileURLToPath(import.meta.url), path.resolve(bundleArg), "--worker", requestMode,
      ...(expectAbsoluteWarning ? ["--expect-absolute-warning"] : []),
    ], { encoding: "utf8", timeout: 30_000 });
    assert.ifError(result.error);
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    assert.equal(result.status, 0, `${requestMode} failed (signal ${result.signal})`);
  }
} else {
  assert.ok(["origin", "query", "absolute"].includes(mode));
  // These requests only exercise local health; never invoke a live integration.
  process.env.VERCEL = "1";
  process.env.NODE_ENV = "production";
  process.env.OPENAI_API_KEY = "";
  process.env.BALKANBITE_AGENT_GITHUB_TOKEN = "";
  const warnings = [];
  process.on("warning", (warning) => warnings.push(warning));
  const require = createRequire(import.meta.url);
  const loaded = require(path.resolve(bundleArg));
  const handler = loaded.default ?? loaded;
  assert.equal(typeof handler, "function");
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const { port } = server.address();
    const requestPath = mode === "absolute"
      ? `http://127.0.0.1:${port}/api/health`
      : `/api/health${mode === "query" ? "?probe=dep0169" : ""}`;
    const response = await new Promise((resolve, reject) => {
      const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("error", reject);
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      request.setTimeout(5_000, () => request.destroy(new Error("Health request timed out")));
      request.on("error", reject);
    });
    assert.equal(response.status, 200);
    const health = JSON.parse(response.body);
    assert.equal(health.status, "ok");
    assert.equal(health.aiConfigured, false);
    assert.match(response.headers["cache-control"], /no-store/);
    await new Promise((resolve) => setImmediate(resolve));
    const dep0169 = warnings.filter((warning) => warning.code === "DEP0169");
    console.log(JSON.stringify({ node: process.version, requestMode: mode,
      status: response.status, dep0169: dep0169.length }));
    // Absolute-form is a diagnostic control, not the production origin-form request.
    if (mode !== "absolute") {
      assert.equal(dep0169.length, 0, "Normal health request emitted DEP0169; see trace above");
    } else if (expectAbsoluteWarning) {
      assert.equal(dep0169.length, 1, "Bundled absolute-form control did not exercise DEP0169");
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
