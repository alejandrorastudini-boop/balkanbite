import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);
const packageSource = fs.readFileSync(
  new URL("../package.json", import.meta.url),
  "utf8",
);
const handoffSource = fs.readFileSync(
  new URL("../BALKANBITE_HANDOFF.md", import.meta.url),
  "utf8",
);

test("GPT-5.6 Luna is the sole runtime AI model/provider", () => {
  assert.match(serverSource, /const OPENAI_MODEL = "gpt-5\.6-luna" as const/);
  assert.match(serverSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(serverSource, /process\.env\.OPENAI_API_KEY/);
  assert.match(serverSource, /store:\s*false/);
  assert.match(serverSource, /reasoning:\s*\{ effort: "low" \}/);
  assert.match(serverSource, /max_output_tokens:\s*16_000/);

  for (const forbidden of [
    "Gemini",
    "gemini-",
    "GEMINI_API_KEY",
    "@google/genai",
    "GoogleGenAI",
  ]) {
    assert.equal(
      serverSource.includes(forbidden),
      false,
      `server runtime must not contain ${forbidden}`,
    );
    assert.equal(
      packageSource.includes(forbidden),
      false,
      `package manifest must not contain ${forbidden}`,
    );
    assert.equal(
      handoffSource.includes(forbidden),
      false,
      `handoff must not advertise ${forbidden}`,
    );
  }
});

test("all six AI endpoints use the shared OpenAI adapter", () => {
  const endpoints = [
    "/api/ai/parse-intent",
    "/api/ai/reconcile-shopping",
    "/api/ai/generate-recipes",
    "/api/ai/generate-weekly-plan",
    "/api/ai/suggest-shopping",
    "/api/ai/scan-image",
  ];

  for (const endpoint of endpoints) {
    const start = serverSource.indexOf(`app.post("${endpoint}"`);
    assert.notEqual(start, -1, `missing endpoint ${endpoint}`);

    const nextEndpoint = serverSource.indexOf("\napp.", start + 10);
    const section =
      nextEndpoint === -1
        ? serverSource.slice(start)
        : serverSource.slice(start, nextEndpoint);

    assert.match(
      section,
      /generateWithOpenAI\(/,
      `${endpoint} must use GPT-5.6 Luna adapter`,
    );
    assert.doesNotMatch(section, /model:\s*["'][^"']+["']/);
  }
});

test("vision uses OpenAI image input and provider-specific source metadata", () => {
  const start = serverSource.indexOf('app.post("/api/ai/scan-image"');
  const end = serverSource.indexOf("// Endpoint: Barcode Lookup", start);
  const scan = serverSource.slice(start, end);

  assert.match(scan, /type:\s*"input_image"/);
  assert.match(scan, /data:\$\{mimeType \|\| "image\/jpeg"\};base64/);
  assert.match(scan, /source:\s*"openai_gpt_5_6_luna_vision"/);
});

test("text generation endpoints expose OpenAI Luna source metadata where source is returned", () => {
  assert.match(serverSource, /source:\s*"openai_gpt_5_6_luna"/);
  assert.doesNotMatch(serverSource, /source:\s*"gemini/);
});


const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function collectTextFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTextFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|json|html|md)$/.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

test("runtime and user-facing app files contain no Gemini provider remnants", () => {
  const files = [
    path.join(repoRoot, "server.ts"),
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "BALKANBITE_HANDOFF.md"),
    ...collectTextFiles(path.join(repoRoot, "src")),
    ...collectTextFiles(path.join(repoRoot, "public")),
  ];

  const forbiddenPatterns = [
    /Gemini/,
    /gemini-/,
    /GEMINI_API_KEY/,
    /@google\/genai/,
    /GoogleGenAI/,
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(
        source,
        pattern,
        `${path.relative(repoRoot, file)} contains stale AI provider reference ${pattern}`,
      );
    }
  }
});
