import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/MealPlanView.tsx", import.meta.url),
  "utf8",
);

test("daily nutrition summary does not present universal personalized targets", () => {
  assert.doesNotMatch(source, /target:\s*2000/);
  assert.doesNotMatch(source, /target:\s*120/);
  assert.doesNotMatch(source, /target:\s*250/);
  assert.doesNotMatch(source, /target:\s*60/);
  assert.doesNotMatch(source, /stat\.value\s*\/\s*stat\.target/);
});

test("daily nutrition summary labels values as verified logged totals, not recommendations", () => {
  assert.match(source, /Verified logged nutrition/);
  assert.match(source, /does not calculate personalized daily targets yet/);
  assert.match(source, /\$\{Math\.round\(stat\.value\)\} \$\{stat\.unit\}/);
});
