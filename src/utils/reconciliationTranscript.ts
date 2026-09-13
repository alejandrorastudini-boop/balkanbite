export interface ExplicitReconciliationAmount {
  quantity: number;
  unit: string;
}

const unitAliases: Array<{ canonical: string; pattern: string }> = [
  { canonical: "kg", pattern: "kg|kgs|kilogram(?:o|os)?|kilograms?|kilo(?:s)?|кг|килограм(?:а)?" },
  { canonical: "g", pattern: "g|gr|gram(?:o|os)?|grams?|г|грам(?:а)?" },
  { canonical: "ml", pattern: "ml|milliliters?|millilitres?|mililitro(?:s)?|мл|милилит(?:ър|ра)" },
  { canonical: "l", pattern: "l|liters?|litres?|litro(?:s)?|л|лит(?:ър|ра)" },
  { canonical: "uds", pattern: "ud|uds|unidad(?:es)?|units?|pcs?|pieces?|бр|брой|броя" },
  { canonical: "pack", pattern: "pack|packs|packet(?:s)?|paquete(?:s)?|пакет(?:а|и)?" },
  { canonical: "bottle", pattern: "bottle(?:s)?|botella(?:s)?|бутилка(?:и)?" },
  { canonical: "can", pattern: "can(?:s)?|tin(?:s)?|lata(?:s)?|консерва(?:и)?" },
  { canonical: "jar", pattern: "jar(?:s)?|bote(?:s)?|frasco(?:s)?|буркан(?:и)?" },
  { canonical: "bunch", pattern: "bunch(?:es)?|manojo(?:s)?|връзка(?:и)?" },
];

const UNIT_PATTERN = unitAliases.map((entry) => `(?:${entry.pattern})`).join("|");
const AMOUNT_PATTERN = new RegExp(
  `(^|[^\\p{L}\\p{N}])(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})(?=$|[^\\p{L}\\p{N}])`,
  "giu"
);

function canonicalizeUnit(raw: string): string | null {
  const cleaned = raw.normalize("NFKC").trim().toLowerCase();
  for (const entry of unitAliases) {
    if (new RegExp(`^(?:${entry.pattern})$`, "iu").test(cleaned)) return entry.canonical;
  }
  return null;
}

function extractPairs(transcript: string) {
  const normalized = transcript.normalize("NFKC");
  const pairs: Array<ExplicitReconciliationAmount & { index: number }> = [];
  AMOUNT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_PATTERN.exec(normalized)) !== null) {
    const quantity = Number(match[2].replace(",", "."));
    const unit = canonicalizeUnit(match[3]);
    if (Number.isFinite(quantity) && quantity > 0 && unit) {
      pairs.push({ quantity, unit, index: match.index + match[1].length });
    }
  }
  return pairs;
}

function candidateNameIndexes(transcript: string, names: string[]): number[] {
  const normalized = transcript.normalize("NFKC").toLowerCase();
  const indexes: number[] = [];
  for (const rawName of names) {
    if (typeof rawName !== "string") continue;
    const tokens = rawName
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 4);
    for (const token of tokens) {
      const variants = new Set([token]);
      if (token.endsWith("es") && token.length > 5) variants.add(token.slice(0, -2));
      if (token.endsWith("s") && token.length > 4) variants.add(token.slice(0, -1));
      for (const variant of variants) {
        const idx = normalized.indexOf(variant);
        if (idx >= 0) indexes.push(idx);
      }
    }
  }
  return indexes;
}

/**
 * Recovers only quantity + unit pairs literally present in the user's transcript.
 * If one extra is proposed and there is exactly one explicit pair, association is
 * unambiguous. With multiple extras, the nearest explicit pair must be within a
 * short textual distance of the extra's name. Server/model defaults are ignored.
 */
export function extractExplicitReconciliationAmount(
  transcript: string,
  names: string[],
  proposedExtraCount: number
): ExplicitReconciliationAmount | null {
  if (typeof transcript !== "string" || !transcript.trim()) return null;
  const pairs = extractPairs(transcript);
  if (pairs.length === 0) return null;
  if (proposedExtraCount === 1 && pairs.length === 1) {
    return { quantity: pairs[0].quantity, unit: pairs[0].unit };
  }

  const nameIndexes = candidateNameIndexes(transcript, names);
  if (nameIndexes.length === 0) return null;

  let best: (ExplicitReconciliationAmount & { index: number; distance: number }) | null = null;
  for (const pair of pairs) {
    const distance = Math.min(...nameIndexes.map((idx) => Math.abs(idx - pair.index)));
    if (distance <= 48 && (!best || distance < best.distance)) {
      best = { ...pair, distance };
    }
  }
  return best ? { quantity: best.quantity, unit: best.unit } : null;
}
