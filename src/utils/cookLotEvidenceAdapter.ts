import type { ConfirmedCookLotEvidence } from "./confirmedCookFirestore";
import type { CookLotEvidencePlan } from "./cookLotEvidencePlanner";

export type CookLotReviewAllocation = Readonly<Record<string, number>>;
export type CookLotReviewSelection = Readonly<Record<
  string,
  string | "unknown" | CookLotReviewAllocation
>>;

export type CookLotEvidenceBuildResult =
  | { outcome: "aggregate"; lotEvidence?: undefined }
  | { outcome: "exact"; lotEvidence: ConfirmedCookLotEvidence[] }
  | { outcome: "invalid"; lotEvidence?: undefined };

const validReviewedOn = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
};

/**
 * Converts an already-reviewed planner result into exact physical-lot evidence.
 * Any explicit "unknown" keeps the whole cook on the conservative aggregate
 * path. Missing, stale or fabricated choices fail closed instead of silently
 * becoming aggregate evidence.
 */
export function buildCookLotEvidence(
  plan: CookLotEvidencePlan,
  selections: CookLotReviewSelection,
  reviewedOn: string,
): CookLotEvidenceBuildResult {
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
  if (
    promptIds.size !== plan.prompts.length ||
    Object.keys(selections).length !== promptIds.size ||
    Object.keys(selections).some(id => !promptIds.has(id))
  ) {
    return { outcome: "invalid" };
  }

  if (plan.prompts.some(prompt => selections[prompt.pantryItemId] === "unknown")) {
    return { outcome: "aggregate" };
  }

  const lotEvidence: ConfirmedCookLotEvidence[] = [];
  for (const prompt of plan.prompts) {
    const selection = selections[prompt.pantryItemId];
    if (!Number.isFinite(prompt.requiredQuantity) || prompt.requiredQuantity <= 0) {
      return { outcome: "invalid" };
    }

    if (typeof selection === "string") {
      const choice = prompt.choices.find(candidate => candidate.lotId === selection);
      if (!choice || choice.unit !== prompt.unit ||
          choice.remainingQuantity + 1e-9 < prompt.requiredQuantity) {
        return { outcome: "invalid" };
      }
      lotEvidence.push({
        pantryItemId: prompt.pantryItemId,
        reviewedOn,
        deductions: [{ lotId: choice.lotId, quantity: prompt.requiredQuantity }],
      });
      continue;
    }

    if (!selection || Array.isArray(selection)) return { outcome: "invalid" };
    const offeredIds = new Set(prompt.choices.map(choice => choice.lotId));
    const entries = Object.entries(selection);
    if (entries.length === 0 || entries.some(([lotId]) => !offeredIds.has(lotId))) {
      return { outcome: "invalid" };
    }
    let total = 0;
    const deductions = [];
    for (const [lotId, quantity] of entries) {
      const choice = prompt.choices.find(candidate => candidate.lotId === lotId);
      if (!choice || choice.unit !== prompt.unit || !Number.isFinite(quantity) ||
          quantity <= 0 || quantity > choice.remainingQuantity + 1e-9) {
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
