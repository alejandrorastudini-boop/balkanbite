import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../src/components/ChefIaModal.tsx", import.meta.url),
  "utf8",
);
const voiceSource = readFileSync(
  new URL("../src/components/VoiceChefView.tsx", import.meta.url),
  "utf8",
);

test("both App voice entry points receive the same current food-safety quarantine", () => {
  const directVoiceStart = appSource.indexOf('{activeTab === "voice"');
  const directVoiceEnd = appSource.indexOf('{activeTab === "profile"', directVoiceStart);
  const directVoiceBlock = appSource.slice(directVoiceStart, directVoiceEnd);

  const modalStart = appSource.indexOf("<ChefIaModal");
  const modalEnd = appSource.indexOf("/>", modalStart);
  const modalBlock = appSource.slice(modalStart, modalEnd);

  assert.match(directVoiceBlock, /foodSafety=\{foodSafetyQuarantine\}/);
  assert.match(modalBlock, /foodSafety=\{foodSafetyQuarantine\}/);
});

test("Chef modal requires and forwards food-safety context to VoiceChefView", () => {
  assert.match(
    modalSource,
    /foodSafety:\s*FoodSafetyQuarantine;/,
  );
  assert.match(
    modalSource,
    /<VoiceChefView[\s\S]*foodSafety=\{foodSafety\}[\s\S]*language=\{language\}/,
  );
});

test("VoiceChefView sends the provided food-safety context to parse-intent", () => {
  assert.match(
    voiceSource,
    /body:\s*JSON\.stringify\(\{[\s\S]*foodSafety,[\s\S]*language,[\s\S]*\}\)/,
  );
});
