import { PantryItem } from "../types";
import { normalizeQuantity, normalizeUnit } from "./quantityUnits";

export interface DeterministicRemovalItem {
  name: string;
  quantity: number;
  unit: string;
  category?: PantryItem["category"];
}

export interface DeterministicRemovalIntent {
  actionType: "REMOVE_ITEMS";
  items: DeterministicRemovalItem[];
}

const normalizeText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”"'!?;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const REMOVAL_PATTERNS = [
  /\bhe usado\b/,
  /\buse\b/,
  /\bhe gastado\b/,
  /\bgaste\b/,
  /\bhe consumido\b/,
  /\bconsumi\b/,
  /\bdescuenta\b/,
  /\bdescontar\b/,
  /\bi used\b/,
  /\bused up\b/,
  /\bi consumed\b/,
  /\bconsumed\b/,
  /\bdeduct\b/,
  /\bизползвах\b/,
  /\bизползвал\b/,
  /\bизразходвах\b/,
  /\bконсумирах\b/,
  /\bмахни\b/,
];

const EXPLICIT_UNIT_PATTERN =
  /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kilogramos?|kilograms?|kilos?|kgs?|kg|gramos?|grams?|gr|g|mililitros?|milliliters?|millilitres?|ml|litros?|liters?|litres?|l|unidades?|units?|items?|pieces?|pcs?|uds?|ud|paquetes?|packets?|packs?|pack|botellas?|bottles?|latas?|cans?|botes?|jars?|porciones?|portions?|filetes?|fillets?|tarrinas?|tubs?|manojos?|bunches?|bunch|cucharadas?|tablespoons?|tbsp|cda|cucharaditas?|teaspoons?|tsp|cdta|pizcas?|pinches?|pinch|кг|грама?|г|мл|литра?|л|броя?|бр|пакети?|бутилки?|консерви?|буркани?|порции?|филета?|кофички?|връзки?)(?:\s|$)/u;

const NUMBER_PATTERN = /(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/;

const STOPWORDS = new Set([
  "fresco",
  "frescos",
  "fresca",
  "frescas",
  "natural",
  "naturales",
  "virgen",
  "extra",
  "fresh",
  "plain",
  "style",
  "tipo",
]);

function scorePantryMatch(transcript: string, item: PantryItem): number {
  const aliases = [item.name, item.nameBg, item.nameEs].filter(Boolean) as string[];
  let bestScore = 0;

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;

    if (transcript.includes(normalizedAlias)) {
      bestScore = Math.max(bestScore, 100 + normalizedAlias.length);
      continue;
    }

    const tokens = normalizedAlias
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
    const matchedTokens = tokens.filter((token) => transcript.includes(token));
    if (matchedTokens.length > 0) {
      bestScore = Math.max(
        bestScore,
        matchedTokens.reduce((sum, token) => sum + token.length, 0)
      );
    }
  }

  return bestScore;
}

function findSinglePantryMatch(transcript: string, pantry: PantryItem[]): PantryItem | null {
  const scored = pantry
    .map((item) => ({ item, score: scorePantryMatch(transcript, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].item;
}

export function parseDeterministicRemovalIntent(
  transcript: string,
  pantry: PantryItem[]
): DeterministicRemovalIntent | null {
  if (typeof transcript !== "string" || !Array.isArray(pantry) || pantry.length === 0) {
    return null;
  }

  const normalizedTranscript = normalizeText(transcript);
  if (!REMOVAL_PATTERNS.some((pattern) => pattern.test(normalizedTranscript))) {
    return null;
  }

  const pantryItem = findSinglePantryMatch(normalizedTranscript, pantry);
  if (!pantryItem) return null;

  const explicit = normalizedTranscript.match(EXPLICIT_UNIT_PATTERN);
  let quantity: number | null = null;
  let unit: string | null = null;

  if (explicit) {
    quantity = Number(explicit[1].replace(",", "."));
    unit = explicit[2];
  } else {
    const numberMatch = normalizedTranscript.match(NUMBER_PATTERN);
    if (!numberMatch) return null;

    quantity = Number(numberMatch[1].replace(",", "."));
    const pantryUnit = normalizeUnit(pantryItem.unit);
    if (!pantryUnit || pantryUnit.dimension !== "count") {
      return null;
    }
    unit = pantryItem.unit;
  }

  if (!Number.isFinite(quantity) || quantity <= 0 || !unit) return null;

  // The fallback is allowed to mutate inventory only when the requested amount
  // is already provably compatible with, and covered by, the matched pantry stock.
  const available = normalizeQuantity(pantryItem.quantity, pantryItem.unit);
  const requested = normalizeQuantity(quantity, unit);
  if (
    !available ||
    !requested ||
    available.unit.dimension !== requested.unit.dimension ||
    available.baseQuantity + 1e-9 < requested.baseQuantity
  ) {
    return null;
  }

  return {
    actionType: "REMOVE_ITEMS",
    items: [
      {
        name: pantryItem.name,
        quantity,
        unit,
        category: pantryItem.category,
      },
    ],
  };
}
