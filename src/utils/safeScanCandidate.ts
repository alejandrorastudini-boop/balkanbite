import type { PantryItem } from "../types";

export type ScanCategory = PantryItem["category"];
export type ScanConfidence = "high" | "medium" | "low";

export interface SafeScanCandidate {
  name: string;
  quantity?: number;
  unit?: string;
  category: ScanCategory;
  estimatedDaysUntilExpiry?: number;
  approximateCostEUR?: number;
  confidence?: ScanConfidence;
}

const VALID_CONFIDENCE = new Set<ScanConfidence>(["high", "medium", "low"]);

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function normalizeScanCategory(value: unknown): ScanCategory {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw.includes("produce") || raw.includes("fruit") || raw.includes("veg")) return "Produce";
  if (raw.includes("dairy") || raw.includes("cheese") || raw.includes("milk")) return "Dairy";
  if (raw.includes("meat") || raw.includes("fish")) return "Meat/Fish";
  if (raw.includes("spice") || raw.includes("herb")) return "Spices";
  if (raw.includes("pantry") || raw.includes("grain") || raw.includes("bake")) return "Pantry/Grains";
  return "Other";
}

export function normalizeScanCandidate(value: unknown): SafeScanCandidate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;

  const unit = typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : undefined;
  const confidence =
    typeof raw.confidence === "string" && VALID_CONFIDENCE.has(raw.confidence as ScanConfidence)
      ? (raw.confidence as ScanConfidence)
      : undefined;

  return {
    name: raw.name.trim(),
    quantity: finitePositive(raw.quantity),
    unit,
    category: normalizeScanCategory(raw.category),
    estimatedDaysUntilExpiry: finiteNonNegative(raw.estimatedDaysUntilExpiry),
    approximateCostEUR: finiteNonNegative(raw.approximateCostEUR),
    confidence,
  };
}

export function isCandidateReadyForPantry(
  candidate: SafeScanCandidate,
): candidate is SafeScanCandidate & { quantity: number; unit: string } {
  return Boolean(
    candidate.name.trim() &&
      typeof candidate.quantity === "number" &&
      Number.isFinite(candidate.quantity) &&
      candidate.quantity > 0 &&
      typeof candidate.unit === "string" &&
      candidate.unit.trim() &&
      candidate.category,
  );
}

export function toPantryPayload(
  candidate: SafeScanCandidate,
): Omit<PantryItem, "id" | "addedAt"> | null {
  if (!isCandidateReadyForPantry(candidate)) return null;

  // Price and expiry values produced by image/barcode analysis remain review-only
  // suggestions. They must not cross the authoritative pantry persistence boundary
  // until BalkanBite has separate field-level confirmation/provenance for them.
  return {
    name: candidate.name.trim(),
    quantity: candidate.quantity,
    unit: candidate.unit.trim(),
    category: candidate.category,
  };
}
