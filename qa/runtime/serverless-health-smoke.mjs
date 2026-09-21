import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const bundleArg = process.argv[2];
if (!bundleArg) {
  throw new Error("Usage: node qa/runtime/serverless-health-smoke.mjs <bundled-api-entry>");
}

process.env.VERCEL = "1";
process.env.NODE_ENV = "production";

const bundlePath = path.resolve(bundleArg);
const require = createRequire(import.meta.url);
const loaded = require(bundlePath);
const handler = loaded?.default ?? loaded;

assert.equal(
  typeof handler,
  "function",
  `Expected bundled API entry to export a handler function: ${pathToFileURL(bundlePath)}`,
);

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Serverless handler rejected during health smoke:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: "handler_rejected" }));
    }
  });
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/health`,
    { signal: AbortSignal.timeout(5_000) },
  );

  const raw = await response.text();
  assert.equal(
    response.status,
    200,
    `Expected /api/health to return 200, got ${response.status}: ${raw}`,
  );

  const payload = JSON.parse(raw);
  assert.equal(payload.status, "ok");
  assert.equal(payload.aiProvider, "openai");
  assert.equal(payload.aiModel, "gpt-5.6-luna");
  assert.equal(typeof payload.aiConfigured, "boolean");

  console.log(
    JSON.stringify({
      serverlessColdStart: "ok",
      statusCode: response.status,
      health: payload,
    }),
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
