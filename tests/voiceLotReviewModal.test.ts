import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/VoiceLotReviewModal.tsx", import.meta.url),
  "utf8",
);

test("voice lot review modal never auto-selects a lot and always offers Unknown", () => {
  assert.match(source, /useState<[^;]+>\(\{\}\)/s);
  assert.match(source, /"unknown"/);
  assert.match(source, /BalkanBite never splits lots automatically/);
  assert.doesNotMatch(source, /setSelections\([^)]*choices\[0\]/);
});

test("voice lot review modal requires exact entered total before confirm", () => {
  assert.match(
    source,
    /Math\.abs\(allocationTotal\(prompt\.pantryItemId\) - prompt\.requiredQuantity\) <= 1e-9/,
  );
  assert.match(source, /disabled=\{!complete \|\| busy\}/);
});

test("voice lot review modal exposes purpose-specific use versus discard wording", () => {
  assert.match(source, /purpose === "discard"/);
  assert.match(source, /Confirm discard/);
  assert.match(source, /Confirm use/);
  assert.match(source, /Confirmar descarte/);
  assert.match(source, /Confirmar uso/);
});

test("expired discard choices are visibly identified instead of hidden", () => {
  assert.match(source, /choice\.expired/);
  assert.match(source, /text\.expired/);
});

test("modal confirmation is async-safe against double submit", () => {
  assert.match(source, /busyRef\.current/);
  assert.match(source, /if \(!complete \|\| busyRef\.current\) return/);
  assert.match(source, /if \(await onConfirm\(selections\)\) onClose\(\)/);
});
