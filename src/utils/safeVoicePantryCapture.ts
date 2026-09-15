import type { PantryItem } from "../types";
import { normalizeScanCategory } from "./safeScanCandidate";

export interface VoicePantryCaptureResult {
  accepted: Array<Omit<PantryItem, "id" | "addedAt">>;
  rejectedCount: number;
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function normalizeVoicePantryItems(values: unknown[]): VoicePantryCaptureResult {
  const accepted: VoicePantryCaptureResult["accepted"] = [];
  let rejectedCount = 0;

  for (const value of values) {
    if (!value || typeof value !== "object") {
      rejectedCount += 1;
      continue;
    }

    const raw = value as Record<string, unknown>;
    const localizedName = nonBlankString(raw.name);
    const name = nonBlankString(raw.nameEn) || localizedName;
    const quantity = finitePositive(raw.quantity);
    const unit = nonBlankString(raw.unit);

    // Quantity and unit change authoritative inventory. If either is uncertain,
    // keep the candidate out of the pantry instead of manufacturing a default.
    if (!name || quantity === undefined || !unit) {
      rejectedCount += 1;
      continue;
    }

    accepted.push({
      name,
      quantity,
      unit,
      category: normalizeScanCategory(raw.category),
    });
  }

  return { accepted, rejectedCount };
}
