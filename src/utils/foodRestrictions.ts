export type EuAnnexIiAllergenId =
  | "cereals_containing_gluten"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "peanuts"
  | "soybeans"
  | "milk"
  | "nuts"
  | "celery"
  | "mustard"
  | "sesame"
  | "sulphur_dioxide_and_sulphites"
  | "lupin"
  | "molluscs";

export type BalkanBiteFoodRestrictionId =
  | `eu_annex_ii:${EuAnnexIiAllergenId}`
  | "intolerance:lactose";

export interface EuAnnexIiAllergenDefinition {
  id: EuAnnexIiAllergenId;
  labels: {
    en: string;
    es: string;
    bg: string;
  };
  source: {
    regulation: "Regulation (EU) No 1169/2011";
    annex: "II";
    consolidatedDate: "2025-04-01";
    eurLex: string;
  };
}

const ANNEX_II_SOURCE = {
  regulation: "Regulation (EU) No 1169/2011",
  annex: "II",
  consolidatedDate: "2025-04-01",
  eurLex: "https://eur-lex.europa.eu/eli/reg/2011/1169/2025-04-01",
} as const;

/**
 * Canonical EU Annex II categories used as the food-allergen taxonomy boundary.
 *
 * These categories describe regulated substances/products for food information.
 * They do not by themselves prove that a recipe/product is safe for a person.
 */
export const EU_ANNEX_II_ALLERGENS: readonly EuAnnexIiAllergenDefinition[] = [
  {
    id: "cereals_containing_gluten",
    labels: {
      en: "Cereals containing gluten",
      es: "Cereales que contengan gluten",
      bg: "Зърнени култури, съдържащи глутен",
    },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "crustaceans",
    labels: { en: "Crustaceans", es: "Crustáceos", bg: "Ракообразни" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "eggs",
    labels: { en: "Eggs", es: "Huevos", bg: "Яйца" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "fish",
    labels: { en: "Fish", es: "Pescado", bg: "Риба" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "peanuts",
    labels: { en: "Peanuts", es: "Cacahuetes", bg: "Фъстъци" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "soybeans",
    labels: { en: "Soybeans", es: "Soja", bg: "Соя" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "milk",
    labels: { en: "Milk", es: "Leche", bg: "Мляко" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "nuts",
    labels: { en: "Nuts", es: "Frutos de cáscara", bg: "Ядки" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "celery",
    labels: { en: "Celery", es: "Apio", bg: "Целина" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "mustard",
    labels: { en: "Mustard", es: "Mostaza", bg: "Синап" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "sesame",
    labels: { en: "Sesame seeds", es: "Granos de sésamo", bg: "Сусамово семе" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "sulphur_dioxide_and_sulphites",
    labels: {
      en: "Sulphur dioxide and sulphites",
      es: "Dióxido de azufre y sulfitos",
      bg: "Серен диоксид и сулфити",
    },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "lupin",
    labels: { en: "Lupin", es: "Altramuces", bg: "Лупина" },
    source: ANNEX_II_SOURCE,
  },
  {
    id: "molluscs",
    labels: { en: "Molluscs", es: "Moluscos", bg: "Мекотели" },
    source: ANNEX_II_SOURCE,
  },
];

export type LegacyFoodRestrictionResolution =
  | {
      status: "resolved";
      rawLabel: string;
      restrictionIds: BalkanBiteFoodRestrictionId[];
      requiresUserConfirmation: false;
    }
  | {
      status: "broad_legacy";
      rawLabel: string;
      restrictionIds: BalkanBiteFoodRestrictionId[];
      requiresUserConfirmation: true;
      reason: "legacy_label_combines_multiple_canonical_categories";
    }
  | {
      status: "unrecognized";
      rawLabel: string;
      restrictionIds: [];
      requiresUserConfirmation: true;
      reason: "unrecognized_legacy_label";
    };

function normalizeLegacyLabel(value: string): string {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

const RESOLVED_LEGACY_LABELS = new Map<
  string,
  readonly BalkanBiteFoodRestrictionId[]
>([
  ["gluten", ["eu_annex_ii:cereals_containing_gluten"]],
  ["лактоза", ["intolerance:lactose"]],
  ["lactosa", ["intolerance:lactose"]],
  ["lactose", ["intolerance:lactose"]],
  ["huevos", ["eu_annex_ii:eggs"]],
  ["eggs", ["eu_annex_ii:eggs"]],
  ["яйца", ["eu_annex_ii:eggs"]],
  ["soja", ["eu_annex_ii:soybeans"]],
  ["soy", ["eu_annex_ii:soybeans"]],
  ["soybeans", ["eu_annex_ii:soybeans"]],
  ["соя", ["eu_annex_ii:soybeans"]],
]);

const BROAD_LEGACY_LABELS = new Map<
  string,
  readonly BalkanBiteFoodRestrictionId[]
>([
  // The old Spanish UI used "Frutos Secos", which is broader/less precise
  // than the Annex II "nuts" category. Screen conservatively for both while
  // requiring the user to confirm the intended restriction later.
  ["frutos secos", ["eu_annex_ii:nuts", "eu_annex_ii:peanuts"]],
  ["nuts", ["eu_annex_ii:nuts", "eu_annex_ii:peanuts"]],
  ["ядки", ["eu_annex_ii:nuts", "eu_annex_ii:peanuts"]],
  // "Marisco" is a broad legacy consumer label spanning at least the separate
  // Annex II crustacean and mollusc categories.
  ["marisco", ["eu_annex_ii:crustaceans", "eu_annex_ii:molluscs"]],
  ["shellfish", ["eu_annex_ii:crustaceans", "eu_annex_ii:molluscs"]],
  ["морски дарове", ["eu_annex_ii:crustaceans", "eu_annex_ii:molluscs"]],
]);

/**
 * Interprets only known legacy UI labels.
 *
 * Broad labels stay explicitly broad and require later user confirmation.
 * Unknown free text is never guessed into a medical/food-safety restriction.
 */
export function resolveLegacyFoodRestriction(
  rawLabel: string,
): LegacyFoodRestrictionResolution {
  const normalized = normalizeLegacyLabel(rawLabel);

  const resolved = RESOLVED_LEGACY_LABELS.get(normalized);
  if (resolved) {
    return {
      status: "resolved",
      rawLabel,
      restrictionIds: [...resolved],
      requiresUserConfirmation: false,
    };
  }

  const broad = BROAD_LEGACY_LABELS.get(normalized);
  if (broad) {
    return {
      status: "broad_legacy",
      rawLabel,
      restrictionIds: [...broad],
      requiresUserConfirmation: true,
      reason: "legacy_label_combines_multiple_canonical_categories",
    };
  }

  return {
    status: "unrecognized",
    rawLabel,
    restrictionIds: [],
    requiresUserConfirmation: true,
    reason: "unrecognized_legacy_label",
  };
}

export function resolveLegacyFoodRestrictions(
  rawLabels: readonly string[] | undefined,
): LegacyFoodRestrictionResolution[] {
  return (rawLabels ?? []).map(resolveLegacyFoodRestriction);
}
