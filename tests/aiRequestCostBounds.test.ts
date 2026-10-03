import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

test("AI requests have deterministic server-side text, collection and serialized-context bounds", () => {
  assert.match(server, /MAX_AI_TEXT_CHARS = 8_000/);
  assert.match(server, /MAX_AI_CONTEXT_ITEMS = 500/);
  assert.match(server, /MAX_AI_CONTEXT_JSON_CHARS = 250_000/);
  assert.match(server, /MAX_AI_IMAGE_BASE64_CHARS = 10_000_000/);
  assert.match(server, /code: "AI_REQUEST_TOO_LARGE"/);
  assert.match(server, /res\.status\(413\)/);
});

test("all model-backed food endpoints reject oversized context before generation", () => {
  const endpoints = [
    "/api/ai/parse-intent",
    "/api/ai/reconcile-shopping",
    "/api/ai/generate-recipes",
    "/api/ai/generate-weekly-plan",
    "/api/ai/suggest-shopping",
    "/api/ai/scan-image",
  ];
  for (let index = 0; index < endpoints.length; index += 1) {
    const start = server.indexOf(`app.post("${endpoints[index]}"`);
    const next = index + 1 < endpoints.length
      ? server.indexOf(`app.post("${endpoints[index + 1]}"`, start + 1)
      : server.indexOf("// Endpoint: Barcode Lookup", start);
    assert.ok(start >= 0 && next > start, endpoints[index]);
    const block = server.slice(start, next);
    assert.match(block, /rejectOversizedAiRequest\(res/);
    const guard = block.indexOf("rejectOversizedAiRequest(res");
    const modelCall = block.indexOf("generateWithOpenAI");
    assert.ok(modelCall < 0 || guard < modelCall, `${endpoints[index]} guard must precede model call`);
  }
});
