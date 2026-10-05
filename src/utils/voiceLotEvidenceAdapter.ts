import type { ConfirmedInventoryLotDeduction } from "./inventoryLots";
import type { VoiceLotEvidencePlan } from "./voiceLotEvidencePlanner";

export type VoiceLotReviewAllocation = Readonly<Record<string, number>>;
export type VoiceLotReviewSelection = Readonly<Record<
  string,
  "unknown" | VoiceLotReviewAllocation
>>;

export interface ConfirmedVoiceLotEvidence {
  pantryItemId: string;
  reviewedOn: string;
  deductions: ConfirmedInventoryLotDeduction[];
}

export type VoiceLotEvidenceBuildResult =
  | { outcome: "aggregate"; lotEvidence?: undefined }
  | { outcome: "exact"; lotEvidence: ConfirmedVoiceLotEvidence[] }
  | { outcome: "invalid"; lotEvidence?: undefined };

const validReviewedOn = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
};

/**
 * Converts only explicit human allocations into physical-lot evidence.
 * Unknown preserves the whole voice mutation on the conservative aggregate
 * path. Missing, fabricated, under/overdrawn or stale choices fail closed.
 */
export function buildVoiceLotEvidence(
  plan: VoiceLotEvidencePlan,
  selections: VoiceLotReviewSelection,
  reviewedOn: string,
): VoiceLotEvidenceBuildResult {
  if (!validReviewedOn(reviewedOn) || !selections || Array.isArray(selections)) {
    return { outcome: "invalid" };
  }
  if (plan.outcome === "invalid") return { outcome: "invalid" };
  if (plan.outcome === "not-needed") {
    return Object.keys(selections).length === 0
      ? { outcome: "aggregate" }
      : { outcome: "invalid" };
  }

  const promptIds = new Set(plan.prompts.map(prompt => prompt.pantryItemId));
  const selectedIds = Object.keys(selections);
  if (
    promptIds.size !== plan.prompts.length ||
    selectedIds.length !== promptIds.size ||
    selectedIds.some(id => !promptIds.has(id))
  ) {
    return { outcome: "invalid" };
  }

  if (plan.prompts.some(prompt => selections[prompt.pantryItemId] === "unknown")) {
    return { outcome: "aggregate" };
  }

  const lotEvidence: ConfirmedVoiceLotEvidence[] = [];
  for (const prompt of plan.prompts) {
    const selection = selections[prompt.pantryItemId];
    if (!selection || selection === "unknown" ||
        !Number.isFinite(prompt.requiredQuantity) || prompt.requiredQuantity <= 0) {
      return { outcome: "invalid" };
    }

    const offered = new Map(prompt.choices.map(choice => [choice.lotId, choice]));
    const entries = Object.entries(selection);
    if (entries.length === 0 || entries.some(([lotId]) => !offered.has(lotId))) {
      return { outcome: "invalid" };
    }

    let total = 0;
    const deductions: ConfirmedInventoryLotDeduction[] = [];
    for (const [lotId, quantity] of entries) {
      const choice = offered.get(lotId);
      if (!choice || choice.unit !== prompt.unit ||
          !Number.isFinite(quantity) || quantity <= 0 ||
          quantity > choice.remainingQuantity + 1e-9) {
        return { outcome: "invalid" };
      }
      total += quantity;
      deductions.push({ lotId, quantity });
    }
    if (Math.abs(total - prompt.requiredQuantity) > 1e-9) {
      return { outcome: "invalid" };
    }

    lotEvidence.push({
      pantryItemId: prompt.pantryItemId,
      reviewedOn,
      deductions: deductions.sort((a, b) => a.lotId.localeCompare(b.lotId)),
    });
  }

  return { outcome: "exact", lotEvidence };
}
