export interface ReviewedBulgarianAliasGroup {
  canonical: string;
  aliases: readonly string[];
  source: string;
}

export interface ReviewedBulgarianHouseholdUnit {
  canonicalUnit: "tbsp" | "tsp";
  aliases: readonly string[];
  source: string;
}

/**
 * Small reviewed Bulgarian-language fixture for deterministic name matching.
 * It is deliberately narrow: these entries may establish equivalence of names
 * only. They must never supply quantity, price, expiry, nutrition, or product
 * identity beyond the cited linguistic equivalence.
 */
export const BULGARIAN_FOOD_ALIAS_FIXTURE: readonly ReviewedBulgarianAliasGroup[] = [
  {
    canonical: "кисело мляко",
    aliases: ["кисело мляко", "йогурт"],
    source: "https://ibl.bas.bg/rbe/lang/bg/%D0%B9%D0%BE%D0%B3%D1%83%D1%80%D1%82/",
  },
  {
    canonical: "мляко",
    aliases: ["мляко", "млеко"],
    source: "https://ibl.bas.bg/rbe/lang/bg/%D0%BC%D0%BB%D1%8F%D0%BA%D0%BE/",
  },
];

/**
 * Reviewed household-unit spellings already supported by quantityUnits.
 * The source establishes the Bulgarian terms; conversion semantics continue
 * to live exclusively in the deterministic unit engine.
 */
export const BULGARIAN_HOUSEHOLD_UNIT_FIXTURE: readonly ReviewedBulgarianHouseholdUnit[] = [
  {
    canonicalUnit: "tbsp",
    aliases: ["супена лъжица"],
    source: "https://ibl.bas.bg/rbe/lang/bg/%D0%BB%D1%8A%D0%B6%D0%B8%D1%86%D0%B0/",
  },
  {
    canonicalUnit: "tsp",
    aliases: ["чаена лъжица"],
    source: "https://ibl.bas.bg/rbe/lang/bg/%D0%BB%D1%8A%D0%B6%D0%B8%D1%86%D0%B0/",
  },
];

const normalizeAlias = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("bg-BG")
    .replace(/\s+/g, " ");

const FOOD_ALIAS_LOOKUP = new Map<string, string>();
for (const group of BULGARIAN_FOOD_ALIAS_FIXTURE) {
  for (const alias of group.aliases) {
    FOOD_ALIAS_LOOKUP.set(normalizeAlias(alias), group.canonical);
  }
}

export function reviewedBulgarianFoodKey(value: string): string | undefined {
  return FOOD_ALIAS_LOOKUP.get(normalizeAlias(value));
}

export function areReviewedBulgarianFoodAliases(a: string, b: string): boolean {
  const keyA = reviewedBulgarianFoodKey(a);
  const keyB = reviewedBulgarianFoodKey(b);
  return Boolean(keyA && keyB && keyA === keyB);
}
