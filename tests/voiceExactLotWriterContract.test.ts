import assert from "node:assert/strict";
import test from "node:test";
import { voiceConsumptionSignature } from "../src/utils/verifiedVoiceConsumptionFirestore";

const base = {
  userId: "user-1",
  mutationId: "voice-1",
  purpose: "food-use" as const,
  expectedStock: [{ pantryItemId: "rice", quantity: 1, unit: "kg", cookRevision: 2 }],
  deductions: [{ ingredientName: "Rice", pantryItemId: "rice", consumedQuantity: 0.3, unit: "kg" }],
};

test("voice replay identity changes when reviewed physical lot evidence changes", () => {
  const a = voiceConsumptionSignature({
    ...base,
    lotEvidence: [{
      pantryItemId: "rice",
      reviewedOn: "2026-10-05",
      deductions: [{ lotId: "lot-a", quantity: 0.3 }],
    }],
  });
  const b = voiceConsumptionSignature({
    ...base,
    lotEvidence: [{
      pantryItemId: "rice",
      reviewedOn: "2026-10-05",
      deductions: [{ lotId: "lot-b", quantity: 0.3 }],
    }],
  });
  assert.ok(a);
  assert.ok(b);
  assert.notEqual(a, b);
});

test("voice exact lot request requires evidence for every expected pantry item", () => {
  assert.equal(
    voiceConsumptionSignature({
      ...base,
      expectedStock: [
        ...base.expectedStock,
        { pantryItemId: "milk", quantity: 1, unit: "l", cookRevision: 0 },
      ],
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-05",
        deductions: [{ lotId: "lot-a", quantity: 0.3 }],
      }],
    }),
    null,
  );
});

test("aggregate voice request remains valid without physical lot evidence", () => {
  assert.ok(voiceConsumptionSignature(base));
});

test("exact voice lot request rejects impossible reviewedOn calendar dates", () => {
  const request = {
    userId: "user_1",
    mutationId: "voice-date-invalid",
    purpose: "food-use" as const,
    expectedStock: [{ pantryItemId: "rice", quantity: 1, unit: "kg", cookRevision: 0 }],
    deductions: [{ ingredientName: "Rice", pantryItemId: "rice", consumedQuantity: 0.2, unit: "kg" }],
    lotEvidence: [{
      pantryItemId: "rice",
      reviewedOn: "2026-02-31",
      deductions: [{ lotId: "lot-a", quantity: 0.2 }],
    }],
  };
  assert.equal(voiceConsumptionSignature(request), null);
});
