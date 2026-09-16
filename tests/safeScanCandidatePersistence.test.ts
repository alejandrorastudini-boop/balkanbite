import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScanCandidate, toPantryPayload } from "../src/utils/safeScanCandidate";

test("scanner price and expiry suggestions stay out of authoritative pantry payload", () => {
  const candidate = normalizeScanCandidate({
    name: "Yogurt",
    quantity: 2,
    unit: "cups",
    category: "dairy",
    approximateCostEUR: 3.4,
    estimatedDaysUntilExpiry: 12,
  });

  assert.ok(candidate);
  const payload = toPantryPayload(candidate);
  assert.deepEqual(payload, {
    name: "Yogurt",
    quantity: 2,
    unit: "cups",
    category: "Dairy",
  });
  assert.equal("estimatedCostEUR" in payload!, false);
  assert.equal("expiryDaysLeft" in payload!, false);
});
