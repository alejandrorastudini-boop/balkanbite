import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

function parseIntentBlock(): string {
  const start = serverSource.indexOf(
    'app.post("/api/ai/parse-intent"',
  );
  const end = serverSource.indexOf(
    "// Endpoint: Voice Shopping Reconciliation",
    start,
  );
  assert.ok(start >= 0 && end > start);
  return serverSource.slice(start, end);
}

test("clinical screening runs before provider availability and free-form generation", () => {
  const block = parseIntentBlock();

  const evaluateIndex = block.indexOf(
    "evaluateClinicalRequestBoundary(transcript)",
  );
  const blockedIndex = block.indexOf(
    "if (clinicalBoundary.blocked)",
    evaluateIndex,
  );
  const keyIndex = block.indexOf("if (!hasOpenAIKey())");
  const generationIndex = block.indexOf("generateWithOpenAI");

  assert.ok(evaluateIndex >= 0);
  assert.ok(blockedIndex > evaluateIndex);
  assert.ok(keyIndex > blockedIndex);
  assert.ok(generationIndex > keyIndex);
});

test("blocked clinical requests return static non-mutating answer metadata", () => {
  const block = parseIntentBlock();
  const start = block.indexOf("if (clinicalBoundary.blocked)");
  const end = block.indexOf("\n  try {", start);
  const blocked = block.slice(start, end);

  assert.match(blocked, /actionType: "ANSWER"/);
  assert.match(
    blocked,
    /spokenFeedback: getClinicalRequestBlockedMessage\(normalizedLanguage\)/,
  );
  assert.match(blocked, /items: \[\]/);
  assert.match(blocked, /mealLog: null/);
  assert.match(blocked, /clinicalGuidanceBlocked: true/);
  assert.match(blocked, /clinicalBoundaryVersion: clinicalBoundary\.version/);
  assert.match(blocked, /clinicalBoundaryReasons: clinicalBoundary\.reasons/);
  assert.doesNotMatch(blocked, /generateWithOpenAI/);
});

test("voice ANSWER prompt is explicitly non-clinical", () => {
  const block = parseIntentBlock();

  assert.match(
    block,
    /"ANSWER": Cooking help, app help, general food questions, or general non-clinical nutrition education\/chat\./,
  );
  assert.doesNotMatch(
    block,
    /General medical\/nutritional guidance or chat/,
  );
  assert.match(block, /Do not provide diagnosis/);
  assert.match(block, /medication or dose recommendations\/changes/);
  assert.match(block, /interpretation of lab results/);
  assert.match(block, /disease-specific therapeutic nutrition advice/);
  assert.match(block, /pregnancy\/lactation/);
});

test("clinical boundary module is imported by the active server", () => {
  const importSection = serverSource.slice(
    0,
    serverSource.indexOf("dotenv.config()"),
  );

  assert.match(
    importSection,
    /evaluateClinicalRequestBoundary/,
  );
  assert.match(
    importSection,
    /getClinicalRequestBlockedMessage/,
  );
  assert.match(
    importSection,
    /clinicalRequestBoundary\.js/,
  );
});
