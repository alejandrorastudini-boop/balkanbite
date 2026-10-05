import type { PantryItem } from "../types";
import type { DeterministicRemovalPurpose } from "./deterministicRemovalIntent";
import {
  deriveInventoryLotExpiry,
  getVerifiedInventoryLotState,
  quantityInParentUnit,
} from "./inventoryLots";
import type { VerifiedVoiceDeduction } from "./verifiedVoiceConsumptionFirestore";

export interface VoiceLotChoice {
  lotId: string;
  acquiredAt: string;
  remainingQuantity: number;
  unit: string;
  expiresOn?: string;
}

export interface VoiceLotEvidencePrompt {
  pantryItemId: string;
  requiredQuantity: number;
  unit: string;
  choices: VoiceLotChoice[];
  allowUnknown: true;
}

export type VoiceLotEvidencePlan =
  | { outcome: "not-needed"; prompts: [] }
  | { outcome: "review"; prompts: VoiceLotEvidencePrompt[] }
  | { outcome: "invalid"; prompts: [] };

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
 * Read-only planner for explicit physical-lot review after a voice deduction
 * has already been resolved to authoritative pantry IDs and quantities.
 *
 * It never chooses a lot or split. Unknown remains available so aggregate
 * mutation can preserve uncertainty. Food-use hides explicitly expired lots;
 * discard may offer them because throwing food away is not consumption.
 */
export function planVoiceLotEvidenceReview(
  pantry: readonly PantryItem[],
  deductions: readonly VerifiedVoiceDeduction[],
  purpose: DeterministicRemovalPurpose,
  reviewedOn: string,
): VoiceLotEvidencePlan {
  if (
    !validReviewedOn(reviewedOn) ||
    (purpose !== "food-use" && purpose !== "discard") ||
    !Array.isArray(deductions) ||
    deductions.length === 0
  ) {
    return { outcome: "invalid", prompts: [] };
  }

  const byId = new Map(pantry.map(item => [item.id, item]));
  if (byId.size !== pantry.length) return { outcome: "invalid", prompts: [] };

  const requiredByItem = new Map<string, number>();
  for (const deduction of deductions) {
    const item = byId.get(deduction.pantryItemId);
    if (!item || !Number.isFinite(deduction.consumedQuantity) ||
        deduction.consumedQuantity <= 0 || typeof deduction.unit !== "string") {
      return { outcome: "invalid", prompts: [] };
    }
    const converted = quantityInParentUnit(
      deduction.consumedQuantity,
      deduction.unit,
      item.unit,
    );
    if (converted === null) return { outcome: "invalid", prompts: [] };
    requiredByItem.set(
      item.id,
      (requiredByItem.get(item.id) ?? 0) + converted,
    );
  }

  const [year, month, day] = reviewedOn.split("-").map(Number);
  const reviewedAt = new Date(year, month - 1, day, 12, 0, 0);
  const prompts: VoiceLotEvidencePrompt[] = [];

  for (const [pantryItemId, rawRequired] of requiredByItem) {
    const item = byId.get(pantryItemId)!;
    const state = getVerifiedInventoryLotState(item);
    if (!state || state.activeLots.length === 0) continue;

    const requiredQuantity = Number(rawRequired.toPrecision(15));
    const choices = state.activeLots.flatMap<VoiceLotChoice>(lot => {
      const expiry = deriveInventoryLotExpiry(lot, reviewedAt);
      if (purpose === "food-use" && expiry.status === "known" && expiry.expired) {
        return [];
      }
      return [{
        lotId: lot.id,
        acquiredAt: lot.acquiredAt,
        remainingQuantity: lot.remainingQuantity,
        unit: item.unit,
        ...(expiry.status === "known" ? { expiresOn: expiry.expiresOn } : {}),
      }];
    });

    const available = choices.reduce((sum, choice) => sum + choice.remainingQuantity, 0);
    if (choices.length > 0 && available + 1e-9 >= requiredQuantity) {
      prompts.push({
        pantryItemId,
        requiredQuantity,
        unit: item.unit,
        choices: choices.sort((a, b) =>
          a.acquiredAt.localeCompare(b.acquiredAt) || a.lotId.localeCompare(b.lotId)
        ),
        allowUnknown: true,
      });
    }
  }

  // Exact provenance is all-or-nothing. Never attach partial lot evidence to
  // only some pantry deductions.
  if (prompts.length > 0 && prompts.length !== requiredByItem.size) {
    return { outcome: "not-needed", prompts: [] };
  }
  return prompts.length > 0
    ? { outcome: "review", prompts }
    : { outcome: "not-needed", prompts: [] };
}
