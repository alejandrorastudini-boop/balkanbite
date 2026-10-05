import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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

test("voice lot evidence is frozen through App and hook retry state", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const hookSource = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
  assert.ok(appSource.includes("lotEvidence?: readonly ConfirmedVoiceLotEvidence[]"));
  assert.ok(appSource.includes("JSON.stringify(plan.lotEvidence ?? []) !== JSON.stringify(lotEvidence ?? [])"));
  assert.ok(appSource.includes("plan.lotEvidence"));
  assert.ok(hookSource.includes("lotEvidence?: readonly ConfirmedVoiceLotEvidence[]"));
  assert.ok(hookSource.includes("prepared.lotEvidence"));
  assert.ok(hookSource.includes("lotEvidence: prepared.lotEvidence"));
});
