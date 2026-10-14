import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

function runFixture(deprecated: boolean) {
  const directory = mkdtempSync(path.join(tmpdir(), "balkanbite-dep0169-"));
  try {
    const bundle = path.join(directory, "handler.cjs");
    writeFileSync(bundle, `
      const { parse } = require('node:url');
      module.exports = (req, res) => {
        ${deprecated ? "parse(req.url);" : ""}
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ status: 'ok', aiConfigured: false }));
      };
    `);
    return spawnSync(process.execPath, [
      "qa/runtime/node-deprecation-smoke.mjs", bundle,
    ], { encoding: "utf8", timeout: 30_000 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("deprecation smoke makes all three real requests to a healthy handler", () => {
  const result = runFixture(false);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const outcomes = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(outcomes.map((outcome) => outcome.requestMode), ["origin", "query", "absolute"]);
  assert.ok(outcomes.every((outcome) => outcome.status === 200 && outcome.dep0169 === 0));
});

test("deprecation smoke fails even when deprecated health still returns HTTP 200", () => {
  const result = runFixture(true);
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"status":200,"dep0169":1/);
  assert.match(result.stderr, /DEP0169/);
  assert.match(result.stderr, /handler\.cjs/);
  assert.match(result.stderr, /Normal health request emitted DEP0169/);
});
