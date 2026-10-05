import type { PantryItem } from "../types";
import type { DeterministicRemovalPurpose } from "./deterministicRemovalIntent";
import type { PantryConsumptionDeduction } from "./pantryConsumption";
import {
  deriveInventoryLotExpiry,
  getVerifiedInventoryLotState,
  quantityInParentUnit,
} from "./inventoryLots";

export interface VoiceLotChoice {
  lotId: string;
  acquiredAt: string;
  remainingQuantity: number;
  unit: string;
  expiresOn?: string;
  expired?: true;
}

export interface VoiceLotReviewPrompt {
  pantryItemId: string;
  requiredQuantity: number;
  unit: string;
  purpose: DeterministicRemovalPurpose;
  choices: VoiceLotChoice[];
  allowUnknown: true;
}

export type VoiceLotReviewPlan =
  | { outcome: "not-needed"; prompts: [] }
  | { outcome: "review"; prompts: VoiceLotReviewPrompt[] }
  | { outcome: "invalid"; prompts: [] };

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
 * Offers only persisted, internally valid physical lots for explicit voice
 * review. It never selects a lot or allocates quantities.
 *
 * food-use excludes lots explicitly known to be expired on reviewedOn.
 * discard may offer expired lots because discarding expired stock is valid.
 * Unknown is always available so physical provenance is never fabricated.
 *
 * Exact review is all-or-nothing for the confirmed aggregate voice removal.
 * Missing lot evidence falls back to the conservative aggregate path; an
 * explicitly present but invalid/unknown-version lotState fails closed.
 */
export function planVoiceLotReview(
  pantry: readonly PantryItem[],
  deductions: readonly PantryConsumptionDeduction[],
  purpose: DeterministicRemovalPurpose,
  reviewedOn: string,
): VoiceLotReviewPlan {
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
    if (
      !deduction ||
      typeof deduction.pantryItemId !== "string" ||
      typeof deduction.consumedQuantity !== "number" ||
      !Number.isFinite(deduction.consumedQuantity) ||
      deduction.consumedQuantity <= 0 ||
      typeof deduction.unit !== "string"
    ) {
      return { outcome: "invalid", prompts: [] };
    }
    const item = byId.get(deduction.pantryItemId);
    if (!item) return { outcome: "invalid", prompts: [] };
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
  const prompts: VoiceLotReviewPrompt[] = [];

  for (const [pantryItemId, requiredRaw] of requiredByItem) {
    const item = byId.get(pantryItemId)!;
    const state = getVerifiedInventoryLotState(item);
    if (!state) {
      if (item.lotState !== undefined) return { outcome: "invalid", prompts: [] };
      return { outcome: "not-needed", prompts: [] };
    }

    const requiredQuantity = Number(requiredRaw.toPrecision(15));
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
        ...(expiry.status === "known"
          ? { expiresOn: expiry.expiresOn, ...(expiry.expired ? { expired: true as const } : {}) }
          : {}),
      }];
    }).sort((a, b) =>
      a.acquiredAt.localeCompare(b.acquiredAt) || a.lotId.localeCompare(b.lotId)
    );

    const reviewableQuantity = choices.reduce(
      (sum, choice) => sum + choice.remainingQuantity,
      0,
    );
    if (choices.length === 0 || reviewableQuantity + 1e-9 < requiredQuantity) {
      return { outcome: "not-needed", prompts: [] };
    }

    prompts.push({
      pantryItemId,
      requiredQuantity,
      unit: item.unit,
      purpose,
      choices,
      allowUnknown: true,
    });
  }

  return { outcome: "review", prompts };
}
