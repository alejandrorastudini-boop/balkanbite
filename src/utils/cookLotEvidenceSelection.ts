import type { ConfirmedCookLotEvidence } from "./confirmedCookFirestore";
import type { CookLotEvidencePlan } from "./cookLotEvidencePlanner";

export interface CookLotSelection {
  pantryItemId: string;
  lotId: string | null;
}

export type CookLotSelectionResult =
  | { outcome: "exact"; lotEvidence: ConfirmedCookLotEvidence[] }
  | { outcome: "unknown"; lotEvidence: undefined }
  | { outcome: "invalid"; lotEvidence: undefined };

/**
 * Converts only explicit user selections from a previously reviewed plan.
 * A null lotId means "I don't know/can't distinguish it" and deliberately
 * preserves the aggregate cook path. Mixed exact+unknown evidence is never
 * emitted because the transaction contract requires complete attribution.
 */
export function buildCookLotEvidenceFromSelections(
  plan: CookLotEvidencePlan,
  selections: readonly CookLotSelection[],
  reviewedOn: string,
): CookLotSelectionResult {
  if (plan.outcome !== "review" || !Array.isArray(selections)) {
    return { outcome: "invalid", lotEvidence: undefined };
  }
  const selectedByItem = new Map<string, string | null>();
  for (const selection of selections) {
    if (
      !selection ||
      typeof selection.pantryItemId !== "string" ||
      selectedByItem.has(selection.pantryItemId) ||
      (selection.lotId !== null && typeof selection.lotId !== "string")
    ) {
      return { outcome: "invalid", lotEvidence: undefined };
    }
    selectedByItem.set(selection.pantryItemId, selection.lotId);
  }
  if (selectedByItem.size !== plan.prompts.length) {
    return { outcome: "invalid", lotEvidence: undefined };
  }

  const lotEvidence: ConfirmedCookLotEvidence[] = [];
  for (const prompt of plan.prompts) {
    if (!selectedByItem.has(prompt.pantryItemId)) {
      return { outcome: "invalid", lotEvidence: undefined };
    }
    const lotId = selectedByItem.get(prompt.pantryItemId)!;
    if (lotId === null) {
      return { outcome: "unknown", lotEvidence: undefined };
    }
    const choice = prompt.choices.find(candidate => candidate.lotId === lotId);
    if (!choice) {
      return { outcome: "invalid", lotEvidence: undefined };
    }
    lotEvidence.push({
      pantryItemId: prompt.pantryItemId,
      reviewedOn,
      deductions: [{ lotId, quantity: prompt.requiredQuantity }],
    });
  }

  return {
    outcome: "exact",
    lotEvidence: lotEvidence.sort((a, b) =>
      a.pantryItemId.localeCompare(b.pantryItemId)
    ),
  };
}
