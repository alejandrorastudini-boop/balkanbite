import assert from "node:assert/strict";
import test from "node:test";
import { voiceConsumptionSignature } from "../src/utils/verifiedVoiceConsumptionFirestore";

const base = {
  userId: "user_1",
  mutationId: "voice-1",
  expectedStock: [{ pantryItemId: "rice", quantity: 1, unit: "kg", cookRevision: 2 }],
  deductions: [{ ingredientName: "Rice", pantryItemId: "rice", consumedQuantity: 0.2, unit: "kg" }],
} as const;

test("voice replay identity binds the explicit removal purpose", () => {
  const foodUse = voiceConsumptionSignature({ ...base, purpose: "food-use" });
  const discard = voiceConsumptionSignature({ ...base, purpose: "discard" });
  assert.ok(foodUse);
  assert.ok(discard);
  assert.notEqual(foodUse, discard);
});

test("voice request rejects missing or unknown removal purpose", () => {
  assert.equal(voiceConsumptionSignature({ ...base, purpose: undefined as never }), null);
  assert.equal(voiceConsumptionSignature({ ...base, purpose: "other" as never }), null);
});
