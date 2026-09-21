import type { ShoppingItem } from "../types";

export interface VoiceShoppingCaptureItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface VoiceShoppingCaptureResult {
  accepted: VoiceShoppingCaptureItem[];
  rejectedCount: number;
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/**
 * Converts model-extracted shopping candidates into reviewable rows only.
 * No price, purchase state, or inventory authority is accepted from the model.
 */
export function normalizeVoiceShoppingItems(
  values: unknown[],
): VoiceShoppingCaptureResult {
  const accepted: VoiceShoppingCaptureItem[] = [];
  let rejectedCount = 0;

  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      rejectedCount += 1;
      continue;
    }

    const raw = value as Record<string, unknown>;
    const name =
      nonBlankString(raw.nameEn) ||
      nonBlankString(raw.name) ||
      nonBlankString(raw.nameEs) ||
      nonBlankString(raw.nameBg);
    const quantity = finitePositive(raw.quantity);
    const unit = nonBlankString(raw.unit);

    if (!name || quantity === undefined || !unit) {
      rejectedCount += 1;
      continue;
    }

    accepted.push({
      name,
      quantity,
      unit,
      category:
        typeof raw.category === "string" ? raw.category.trim() : "",
    });
  }

  return { accepted, rejectedCount };
}

export function buildConfirmedVoiceShoppingItems(
  values: unknown[],
  idFactory: (index: number) => string,
): {
  items: ShoppingItem[];
  rejectedCount: number;
} {
  const { accepted, rejectedCount } = normalizeVoiceShoppingItems(values);

  return {
    items: accepted.map((item, index) => ({
      id: idFactory(index),
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      checked: false,
      amountOrigin: "user_entered",
      purchaseAmountConfirmed: false,
    })),
    rejectedCount,
  };
}
