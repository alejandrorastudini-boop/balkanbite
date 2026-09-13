import { normalizeUnit } from "./quantityUnits";
import type { RawReconciliationExtraItem } from "./purchasePantryMerge";

const normalizeEvidenceText = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[,]/g, ".")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const numericValues = (text: string): number[] =>
  Array.from(text.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

function hasExplicitQuantity(text: string, quantity: number): boolean {
  const epsilon = 1e-9;
  return numericValues(text).some((value) => Math.abs(value - quantity) <= epsilon);
}

function hasExplicitUnit(text: string, unit: string): boolean {
  const expected = normalizeUnit(unit);
  if (!expected) return false;

  const tokens = text.split(" ").filter(Boolean);
  const maxWords = Math.min(3, tokens.length);

  for (let width = 1; width <= maxWords; width += 1) {
    for (let start = 0; start + width <= tokens.length; start += 1) {
      const phrase = tokens.slice(start, start + width).join(" ");
      const candidate = normalizeUnit(phrase);
      if (!candidate) continue;

      if (expected.known) {
        if (candidate.known && candidate.canonical === expected.canonical) return true;
      } else if (!candidate.known && candidate.canonical === expected.canonical) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extra purchases inferred by AI may only become selectable when the user's
 * own transcript explicitly contains the same numeric quantity and unit.
 * This prevents provider/fallback defaults (for example 1 pcs) from becoming
 * pantry facts merely because the model returned them.
 */
export function hasExplicitReconciliationEvidence(
  item: RawReconciliationExtraItem,
  transcript: string
): boolean {
  if (typeof transcript !== "string" || !transcript.trim()) return false;
  if (typeof item?.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (typeof item?.unit !== "string" || !item.unit.trim()) return false;

  const text = normalizeEvidenceText(transcript);
  if (!text) return false;

  return hasExplicitQuantity(text, item.quantity) && hasExplicitUnit(text, item.unit);
}
