import type { PantryItem } from "../types";
import type { VerifiedVoiceRemovalPurpose } from "./verifiedVoiceConsumptionFirestore";
import {
  deriveInventoryLotExpiry,
  getVerifiedInventoryLotState,
  quantityInParentUnit,
} from "./inventoryLots";

export interface VoiceLotReviewDeduction {
  pantryItemId: string;
  consumedQuantity: number;
  unit: string;
}

export interface VoiceLotChoice {
  lotId: string;
  acquiredAt: string;
  remainingQuantity: number;
  unit: string;
  expiresOn?: string;
  expired?: true;
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

const validReviewedOn = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
};

/**
 * Builds a review surface from persisted acquisition lots only.
 *
 * It never selects a lot, never invents provenance and always leaves Unknown
 * available. Food-use excludes explicitly expired lots; discard keeps them
 * selectable because disposal is not ingestion. Exact evidence remains
 * all-or-nothing across the reviewed voice mutation.
 */
export function planVoiceLotEvidenceReview(
  pantry: readonly PantryItem[],
  deductions: readonly VoiceLotReviewDeduction[],
  purpose: VerifiedVoiceRemovalPurpose,
  reviewedOn: string,
): VoiceLotEvidencePlan {
  if (
    !validReviewedOn(reviewedOn) ||
    (purpose !== "food-use" && purpose !== "discard") ||
    !Array.isArray(deductions) ||
    deductions.length === 0
  ) return { outcome: "invalid", prompts: [] };

  const byId = new Map(pantry.map(item => [item.id, item]));
  if (byId.size !== pantry.length) return { outcome: "invalid", prompts: [] };

  const requiredByItem = new Map<string, number>();
  for (const deduction of deductions) {
    const item = byId.get(deduction?.pantryItemId);
    if (
      !item ||
      typeof deduction.consumedQuantity !== "number" ||
      !Number.isFinite(deduction.consumedQuantity) ||
      deduction.consumedQuantity <= 0 ||
      typeof deduction.unit !== "string"
    ) return { outcome: "invalid", prompts: [] };
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

  for (const [pantryItemId, requiredRaw] of requiredByItem) {
    const item = byId.get(pantryItemId)!;
    const state = getVerifiedInventoryLotState(item);
    if (!state || state.activeLots.length === 0) continue;

    const requiredQuantity = Number(requiredRaw.toPrecision(15));
    const choices = state.activeLots.flatMap<VoiceLotChoice>(lot => {
      const expiry = deriveInventoryLotExpiry(lot, reviewedAt);
      const expired = expiry.status === "known" && expiry.expired;
      if (purpose === "food-use" && expired) return [];
      return [{
        lotId: lot.id,
        acquiredAt: lot.acquiredAt,
        remainingQuantity: lot.remainingQuantity,
        unit: item.unit,
        ...(expiry.status === "known" ? { expiresOn: expiry.expiresOn } : {}),
        ...(expired ? { expired: true as const } : {}),
      }];
    });

    const reviewableQuantity = choices.reduce(
      (sum, choice) => sum + choice.remainingQuantity,
      0,
    );
    if (choices.length > 0 && reviewableQuantity + 1e-9 >= requiredQuantity) {
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

  if (prompts.length > 0 && prompts.length !== requiredByItem.size) {
    return { outcome: "not-needed", prompts: [] };
  }
  return prompts.length > 0
    ? { outcome: "review", prompts }
    : { outcome: "not-needed", prompts: [] };
}
