import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { captureGuestLocalSnapshot } from "../src/utils/guestLocalExport";
import { inspectGuestLocalExportStructure } from "../src/utils/guestLocalExportInspection";

const result = captureGuestLocalSnapshot({ getItem(k) {
  return k === "balkanbite_pantry" ? "{original malformed guest data" : null;
}}, "2026-10-24T15:00:00.000Z");
assert.equal(result.ok, true);
if (!result.ok) throw Error("fixture failed");
test("recognizes exact v1 raw export without interpreting malformed inner bytes", () => {
  assert.equal(inspectGuestLocalExportStructure(result.content), "recognized");
  assert.equal(JSON.parse(result.content).values.balkanbite_pantry, "{original malformed guest data");
});
test("rejects version drift, missing keys, extra secrets, invalid root and foreign scope", () => {
  const original = JSON.parse(result.content);
  for (const invalid of [
    "broken json", "[]", "null", JSON.stringify({}),
    JSON.stringify({ ...original, version: 2 }),
    JSON.stringify({ ...original, scope: "authenticated" }),
    JSON.stringify({ ...original, restoreSupported: true }),
    JSON.stringify({ ...original, extra: "unknown" }),
    JSON.stringify({ ...original, capturedAt: "unknown" }),
    JSON.stringify({ ...original, values: { balkanbite_pantry: "[]" } }),
    JSON.stringify({ ...original, values: { ...original.values, authToken: "secret" } }),
    JSON.stringify({ ...original, values: { ...original.values, balkanbite_pantry: 123 } }),
  ]) assert.equal(inspectGuestLocalExportStructure(invalid), "unrecognized");
});
test("inspection stays read only and does not advertise import or restore", () => {
  const profile = readFileSync(new URL("../src/components/ProfileView.tsx", import.meta.url), "utf8");
  assert.match(profile, /guest-local-export-inspect-input/);
  assert.match(profile, /inspectGuestLocalExportStructure\(await file\.text\(\)\)/);
  assert.doesNotMatch(profile, /onImportGuestData|restoreGuestLocalArchive/);
});
