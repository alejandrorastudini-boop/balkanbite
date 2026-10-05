import assert from "node:assert/strict";
import test from "node:test";
import type { VoiceLotEvidencePlan } from "../src/utils/voiceLotEvidencePlanner";
import { buildVoiceLotEvidence } from "../src/utils/voiceLotEvidenceAdapter";

const plan: VoiceLotEvidencePlan = {
  outcome: "review",
  prompts: [{
    pantryItemId: "rice",
    requiredQuantity: 0.7,
    unit: "kg",
    allowUnknown: true,
    choices: [
      { lotId: "old", acquiredAt: "2026-09-01", remainingQuantity: 0.4, unit: "kg" },
      { lotId: "new", acquiredAt: "2026-10-03", remainingQuantity: 0.6, unit: "kg" },
    ],
  }],
};

test("voice adapter builds exact multi-lot evidence only from explicit quantities", () => {
  assert.deepEqual(
    buildVoiceLotEvidence(
      plan,
      { rice: { old: 0.4, new: 0.3 } },
      "2026-10-05",
    ),
    {
      outcome: "exact",
      lotEvidence: [{
        pantryItemId: "rice",
        reviewedOn: "2026-10-05",
        deductions: [
          { lotId: "new", quantity: 0.3 },
          { lotId: "old", quantity: 0.4 },
        ],
      }],
    },
  );
});

test("unknown keeps the whole voice mutation aggregate", () => {
  assert.deepEqual(
    buildVoiceLotEvidence(plan, { rice: "unknown" }, "2026-10-05"),
    { outcome: "aggregate" },
  );
});

test("voice adapter fails closed on underdraw, overdraw and fabricated lots", () => {
  assert.equal(buildVoiceLotEvidence(plan, { rice: { old: 0.4, new: 0.2 } }, "2026-10-05").outcome, "invalid");
  assert.equal(buildVoiceLotEvidence(plan, { rice: { old: 0.4, new: 0.4 } }, "2026-10-05").outcome, "invalid");
  assert.equal(buildVoiceLotEvidence(plan, { rice: { fake: 0.7 } }, "2026-10-05").outcome, "invalid");
  assert.equal(buildVoiceLotEvidence(plan, { rice: { old: 0.5, new: 0.2 } }, "2026-10-05").outcome, "invalid");
});

test("voice adapter requires exact prompt coverage and a valid stable review date", () => {
  assert.equal(buildVoiceLotEvidence(plan, {}, "2026-10-05").outcome, "invalid");
  assert.equal(buildVoiceLotEvidence(plan, { rice: "unknown", extra: "unknown" }, "2026-10-05").outcome, "invalid");
  assert.equal(buildVoiceLotEvidence(plan, { rice: "unknown" }, "2026-02-31").outcome, "invalid");
});
