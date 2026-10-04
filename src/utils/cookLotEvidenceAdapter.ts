import type { ConfirmedCookLotEvidence } from "./confirmedCookFirestore";
import type { CookLotEvidencePlan } from "./cookLotEvidencePlanner";

export type CookLotReviewSelection = Readonly<Record<string, string | "unknown">>;

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
    const selectedLotId = selections[prompt.pantryItemId];
    if (typeof selectedLotId !== "string" || !selectedLotId) {
      return { outcome: "invalid" };
    }
    const choice = prompt.choices.find(candidate => candidate.lotId === selectedLotId);
    if (!choice) return { outcome: "invalid" };
    if (
      !Number.isFinite(prompt.requiredQuantity) ||
      prompt.requiredQuantity <= 0 ||
      choice.unit !== prompt.unit ||
      choice.remainingQuantity + 1e-9 < prompt.requiredQuantity
    ) {
      return { outcome: "invalid" };
    }
    lotEvidence.push({
      pantryItemId: prompt.pantryItemId,
      reviewedOn,
      deductions: [{
        lotId: choice.lotId,
        quantity: prompt.requiredQuantity,
      }],
    });
  }

  return { outcome: "exact", lotEvidence };
}
