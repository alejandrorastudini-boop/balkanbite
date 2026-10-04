import type { PantryItem } from "../types";
import type { CookConfirmation } from "./confirmedCookTransaction";
import {
  deriveInventoryLotExpiry,
  getVerifiedInventoryLotState,
  quantityInParentUnit,
} from "./inventoryLots";

export interface CookLotChoice {
  lotId: string;
  acquiredAt: string;
  remainingQuantity: number;
  unit: string;
  expiresOn?: string;
}

export interface CookLotEvidencePrompt {
  pantryItemId: string;
  requiredQuantity: number;
  unit: string;
  choices: CookLotChoice[];
  allowUnknown: true;
}

export type CookLotEvidencePlan =
  | { outcome: "not-needed"; prompts: [] }
  | { outcome: "review"; prompts: CookLotEvidencePrompt[] }
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
 * Produces review choices only from already-authoritative acquisition evidence.
 * It never chooses a lot and never turns unallocated stock into a physical lot.
 *
 * A single usable lot needs no physical-choice prompt: aggregate deduction is
 * already truthful and preserving exact provenance would add user friction
 * without resolving ambiguity. Multiple usable lots are reviewable only when
 * the entire confirmed amount could be attributed to at least one real lot.
 * "Unknown" is always allowed so the caller can preserve conservative
 * aggregate behavior instead of fabricating precision.
 */
export function planCookLotEvidenceReview(
  pantry: readonly PantryItem[],
  confirmation: CookConfirmation,
  reviewedOn: string,
): CookLotEvidencePlan {
  if (!validReviewedOn(reviewedOn) || confirmation.confirmed !== true) {
    return { outcome: "invalid", prompts: [] };
  }

  const byId = new Map(pantry.map(item => [item.id, item]));
  if (byId.size !== pantry.length) return { outcome: "invalid", prompts: [] };

  const requiredByItem = new Map<string, number>();
  for (const ingredient of confirmation.ingredients) {
    if (
      typeof ingredient.pantryItemId !== "string" ||
      typeof ingredient.quantity !== "number" ||
      !Number.isFinite(ingredient.quantity) ||
      ingredient.quantity <= 0 ||
      typeof ingredient.unit !== "string"
    ) {
      return { outcome: "invalid", prompts: [] };
    }
    const item = byId.get(ingredient.pantryItemId);
    if (!item) return { outcome: "invalid", prompts: [] };
    const converted = quantityInParentUnit(
      ingredient.quantity,
      ingredient.unit,
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
  const prompts: CookLotEvidencePrompt[] = [];
  let hasKnownLotProvenance = false;

  for (const [pantryItemId, requiredQuantityRaw] of requiredByItem) {
    const item = byId.get(pantryItemId)!;
    const state = getVerifiedInventoryLotState(item);
    if (!state || state.activeLots.length === 0) continue;
    hasKnownLotProvenance = true;
    if (state.activeLots.length <= 1) continue;

    const requiredQuantity = Number(requiredQuantityRaw.toPrecision(15));
    const choices = state.activeLots.flatMap<CookLotChoice>(lot => {
      const expiry = deriveInventoryLotExpiry(lot, reviewedAt);
      if (expiry.status === "known" && expiry.expired) return [];
      if (lot.remainingQuantity + 1e-9 < requiredQuantity) return [];
      return [{
        lotId: lot.id,
        acquiredAt: lot.acquiredAt,
        remainingQuantity: lot.remainingQuantity,
        unit: item.unit,
        ...(expiry.status === "known" ? { expiresOn: expiry.expiresOn } : {}),
      }];
    });

    if (choices.length >= 2) {
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

  // Exact physical evidence is all-or-nothing for a cook request. If any
  // referenced item has known lot provenance but cannot be reviewed
  // unambiguously here, do not offer partial evidence for other items.
  if (hasKnownLotProvenance && prompts.length !== requiredByItem.size) {
    return { outcome: "not-needed", prompts: [] };
  }
  return prompts.length > 0
    ? { outcome: "review", prompts }
    : { outcome: "not-needed", prompts: [] };
}
