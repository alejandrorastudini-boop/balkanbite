import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

function parseIntentBlock(): string {
  const start = serverSource.indexOf('app.post("/api/ai/parse-intent"');
  const end = serverSource.indexOf(
    '// Endpoint: Voice Shopping Reconciliation',
    start,
  );
  assert.ok(start >= 0);
  assert.ok(end > start);
  return serverSource.slice(start, end);
}

test("parse-intent runs deterministic clinical boundary before any OpenAI call", () => {
  const block = parseIntentBlock();
  const guardIndex = block.indexOf(
    "const clinicalBoundary = assessVoiceClinicalBoundary(transcript)",
  );
  const keyCheckIndex = block.indexOf("if (!hasOpenAIKey())");
  const aiCallIndex = block.indexOf("generateWithOpenAI({");

  assert.ok(guardIndex >= 0);
  assert.ok(keyCheckIndex > guardIndex);
  assert.ok(aiCallIndex > keyCheckIndex);
  assert.match(
    block,
    /if \(clinicalBoundary\.blocked\) \{[\s\S]*clinicalBlocked: true/,
  );
  assert.match(
    block,
    /spokenFeedback: getVoiceClinicalBoundaryMessage\(responseLanguage\)/,
  );
});

test("blocked clinical response is inert and cannot mutate product state", () => {
  const block = parseIntentBlock();
  const guardStart = block.indexOf("if (clinicalBoundary.blocked)");
  const tryStart = block.indexOf("try {", guardStart);
  const guardBlock = block.slice(guardStart, tryStart);

  assert.match(guardBlock, /actionType: "ANSWER"/);
  assert.match(guardBlock, /items: \[\]/);
  assert.match(guardBlock, /mealLog: null/);
  assert.doesNotMatch(guardBlock, /ADD_ITEMS|REMOVE_ITEMS|ADD_SHOPPING|MEAL_LOG/);
});

test("voice prompt no longer delegates general medical guidance to the LLM", () => {
  const block = parseIntentBlock();

  assert.doesNotMatch(
    block,
    /"ANSWER": General medical\/nutritional guidance or chat/,
  );
  assert.match(
    block,
    /"ANSWER": General cooking help, food organization, app help, casual chat, or general non-clinical nutrition education/,
  );
  assert.match(
    block,
    /Do not diagnose, assess symptoms, provide prognosis or treatment\/cure instructions/,
  );
  assert.match(
    block,
    /Do not improvise a medical answer/,
  );
  assert.match(
    block,
    /General nutrition education is allowed when it is not tailored to a disease/,
  );
});

test("clinical boundary helpers are imported by the active server", () => {
  assert.match(
    serverSource,
    /assessVoiceClinicalBoundary,[\s\S]*getVoiceClinicalBoundaryMessage,[\s\S]*voiceClinicalBoundary\.js/,
  );
});
