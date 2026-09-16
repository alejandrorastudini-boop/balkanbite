import test from "node:test";
import assert from "node:assert/strict";
import { isConfirmedScanCandidate } from "../src/utils/confirmedScanCandidate";
import { normalizeScanCandidate } from "../src/utils/safeScanCandidate";

const suggestedCandidate = normalizeScanCandidate({
  name: "Yogurt",
  quantity: 2,
  unit: "cups",
  category: "dairy",
});

if (!suggestedCandidate) throw new Error("Expected a valid test candidate");

test("scanner-supplied quantity and unit are not authoritative without confirmation", () => {
  assert.equal(isConfirmedScanCandidate(suggestedCandidate, false, false), false);
  assert.equal(isConfirmedScanCandidate(suggestedCandidate, true, false), false);
  assert.equal(isConfirmedScanCandidate(suggestedCandidate, false, true), false);
  assert.equal(isConfirmedScanCandidate(suggestedCandidate, true, true), true);
});

test("confirmation cannot make unknown quantity or unit persistable", () => {
  const missingQuantity = normalizeScanCandidate({ name: "Yogurt", unit: "cups" });
  const missingUnit = normalizeScanCandidate({ name: "Yogurt", quantity: 2 });

  assert.ok(missingQuantity);
  assert.ok(missingUnit);
  assert.equal(isConfirmedScanCandidate(missingQuantity, true, true), false);
  assert.equal(isConfirmedScanCandidate(missingUnit, true, true), false);
});
