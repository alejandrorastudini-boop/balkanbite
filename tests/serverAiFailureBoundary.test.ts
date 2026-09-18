import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

function endpointSection(startMarker: string, endMarker: string) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing endpoint start: ${startMarker}`);
  assert.notEqual(end, -1, `missing endpoint end: ${endMarker}`);
  return serverSource.slice(start, end);
}

test("visual scanner failures are explicit no-result states", () => {
  const scan = endpointSection(
    'app.post("/api/ai/scan-image"',
    '// Endpoint: Barcode Lookup'
  );

  assert.match(scan, /success:\s*true/);
  assert.match(scan, /status\(503\)\.json\(\{[\s\S]*success:\s*false[\s\S]*items:\s*\[\]/);
  assert.doesNotMatch(scan, /mock_fallback|resilient_fallback/);
  assert.doesNotMatch(scan, /Detected Grocery|Alimento detectado|Открита храна/);
});

test("shopping AI failure has no fabricated basket fallback", () => {
  const shopping = endpointSection(
    'app.post("/api/ai/suggest-shopping"',
    '// Endpoint: AI Visual Scanner'
  );

  assert.match(
    shopping,
    /status\(503\)\.json\(\{[\s\S]*Shopping suggestions are temporarily unavailable[\s\S]*items:\s*\[\]/
  );
  assert.doesNotMatch(shopping, /resilient_fallback/);
  assert.doesNotMatch(shopping, /This core basket costs under/);
  assert.doesNotMatch(shopping, /Include accurate prices/);
  assert.match(shopping, /unverified planning estimate only/);
});
