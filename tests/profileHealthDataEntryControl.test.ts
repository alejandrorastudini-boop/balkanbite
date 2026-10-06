import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("profile exposes explicit opt-in entry for missing HealthProfile fields", () => {
  assert.match(source, /health-profile-entry-card/);
  assert.match(source, /missingHealthFields/);
  assert.match(source, /setSelfReportedHealthProfileField/);
  assert.match(source, /No defaults are used/);
});

test("health entry preserves unknown, not-applicable and prefer-not-to-say states", () => {
  assert.match(source, /value="unknown"/);
  assert.match(source, /value="not_applicable"/);
  assert.match(source, /value="prefer_not_to_say"/);
});

test("health entry describes provenance and remains user initiated", () => {
  assert.match(source, /Source: self-reported/);
  assert.match(source, /onClick=\{\(\) => beginHealthFieldEntry\(field\)\}/);
  assert.doesNotMatch(source, /setSelfReportedHealthProfileField\([^)]*default/i);
});

test("pregnancy/lactation entry uses progressive disclosure", () => {
  assert.match(source, /field === "pregnancyLactationStatus"/);
  assert.match(source, /knownPhysiologicalSex === "female"/);
});
