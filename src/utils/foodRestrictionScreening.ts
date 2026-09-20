import {
  EU_ANNEX_II_ALLERGENS,
  type BalkanBiteFoodRestrictionId,
} from "./foodRestrictions";

export type FoodRestrictionScreeningStatus =
  | "match_detected"
  | "no_match_detected"
  | "unverifiable";

export interface FoodRestrictionScreeningResult {
  restrictionId: BalkanBiteFoodRestrictionId;
  status: FoodRestrictionScreeningStatus;
  matchedIngredients: string[];
  unverifiableIngredients: string[];
}

export interface RecipeFoodRestrictionScreening {
  status: FoodRestrictionScreeningStatus;
  restrictionResults: FoodRestrictionScreeningResult[];
  evidenceScope: "declared_ingredient_names_only";
  crossContactEvidence: "unknown";
  establishesAllergenSafety: false;
}

interface IngredientRule {
  names: readonly string[];
  restrictionIds: readonly BalkanBiteFoodRestrictionId[];
  composition: "known" | "processed_or_compound";
}

const ALL_RESTRICTION_IDS = new Set<BalkanBiteFoodRestrictionId>([
  ...EU_ANNEX_II_ALLERGENS.map(
    (item) => ("eu_annex_ii:" + item.id) as BalkanBiteFoodRestrictionId,
  ),
  "intolerance:lactose",
]);

function normalizeIngredientName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const DIRECT_RULES: readonly IngredientRule[] = [
  {
    names: [
      "wheat", "trigo", "пшеница",
      "rye", "centeno", "ръж",
      "barley", "cebada", "ечемик",
      "oats", "oat", "avena", "овес",
      "spelt", "espelta", "спелта", "шпелта",
      "kamut", "khorasan wheat", "trigo khorasan", "пшеница хорасан",
    ],
    restrictionIds: ["eu_annex_ii:cereals_containing_gluten"],
    composition: "known",
  },
  {
    names: ["crustaceans", "crustacean", "crustaceos", "crustaceo", "ракообразни"],
    restrictionIds: ["eu_annex_ii:crustaceans"],
    composition: "known",
  },
  {
    names: ["egg", "eggs", "huevo", "huevos", "яйце", "яйца", "fresh eggs", "huevos frescos", "пресни яйца"],
    restrictionIds: ["eu_annex_ii:eggs"],
    composition: "known",
  },
  {
    names: ["fish", "pescado", "риба"],
    restrictionIds: ["eu_annex_ii:fish"],
    composition: "known",
  },
  {
    names: ["peanut", "peanuts", "cacahuete", "cacahuetes", "фъстък", "фъстъци"],
    restrictionIds: ["eu_annex_ii:peanuts"],
    composition: "known",
  },
  {
    names: ["soy", "soybean", "soybeans", "soja", "соя"],
    restrictionIds: ["eu_annex_ii:soybeans"],
    composition: "known",
  },
  {
    names: ["milk", "leche", "мляко"],
    restrictionIds: ["eu_annex_ii:milk", "intolerance:lactose"],
    composition: "known",
  },
  {
    names: ["lactose", "lactosa", "лактоза"],
    restrictionIds: ["eu_annex_ii:milk", "intolerance:lactose"],
    composition: "known",
  },
  {
    names: [
      "almond", "almonds", "almendra", "almendras", "бадем", "бадеми",
      "hazelnut", "hazelnuts", "avellana", "avellanas", "лешник", "лешници",
      "walnut", "walnuts", "nuez", "nueces", "орех", "орехи",
      "cashew", "cashews", "anacardo", "anacardos", "кашу",
      "pecan", "pecans", "nuez pecana", "nueces pecanas", "пекан", "пеканови ядки",
      "brazil nut", "brazil nuts", "nuez de brasil", "nueces de brasil", "бразилски орех", "бразилски орехи",
      "pistachio", "pistachios", "pistacho", "pistachos", "шамфъстък",
      "macadamia", "macadamias", "макадамия", "орехи макадамия",
    ],
    restrictionIds: ["eu_annex_ii:nuts"],
    composition: "known",
  },
  {
    names: ["celery", "apio", "целина"],
    restrictionIds: ["eu_annex_ii:celery"],
    composition: "known",
  },
  {
    names: ["mustard", "mostaza", "синап", "горчица"],
    restrictionIds: ["eu_annex_ii:mustard"],
    composition: "known",
  },
  {
    names: ["sesame", "sesame seeds", "sesamo", "semillas de sesamo", "сусам", "сусамово семе"],
    restrictionIds: ["eu_annex_ii:sesame"],
    composition: "known",
  },
  {
    names: ["lupin", "lupine", "altramuz", "altramuces", "лупина"],
    restrictionIds: ["eu_annex_ii:lupin"],
    composition: "known",
  },
  {
    names: ["mollusc", "molluscs", "molusco", "moluscos", "мекотело", "мекотели"],
    restrictionIds: ["eu_annex_ii:molluscs"],
    composition: "known",
  },
];

const PROCESSED_RULES: readonly IngredientRule[] = [
  {
    names: [
      "cheese", "queso", "сирене",
      "parmesan", "parmesano", "пармезан",
      "cream cheese", "queso crema", "крема сирене",
      "yogurt", "yoghurt", "yogur", "кисело мляко",
    ],
    restrictionIds: ["eu_annex_ii:milk"],
    composition: "processed_or_compound",
  },
  {
    names: ["mayonnaise", "mayo", "mayonesa", "майонеза"],
    restrictionIds: ["eu_annex_ii:eggs"],
    composition: "processed_or_compound",
  },
  {
    names: ["soy sauce", "salsa de soja", "соев сос"],
    restrictionIds: ["eu_annex_ii:soybeans"],
    composition: "processed_or_compound",
  },
  {
    names: ["peanut butter", "mantequilla de cacahuete", "фъстъчено масло"],
    restrictionIds: ["eu_annex_ii:peanuts"],
    composition: "processed_or_compound",
  },
  {
    names: ["wheat bread", "pan de trigo", "пшеничен хляб"],
    restrictionIds: ["eu_annex_ii:cereals_containing_gluten"],
    composition: "processed_or_compound",
  },
];

const RULES: readonly IngredientRule[] = [...DIRECT_RULES, ...PROCESSED_RULES];

const SIMPLE_KNOWN_NON_ALLERGEN_NAMES = new Set(
  [
    "tomato", "tomatoes", "tomate", "tomates", "домат", "домати",
    "rice", "cooked rice", "arroz", "arroz cocido", "ориз", "сварен ориз",
    "chicken", "chicken breast", "pollo", "pechuga de pollo", "pechugas de pollo", "пиле", "пилешки гърди",
    "beef", "carne de vacuno", "говеждо",
    "pork", "cerdo", "свинско",
    "lentils", "lentejas", "леща",
    "chickpeas", "garbanzos", "нахут",
    "zucchini", "calabacin", "тиквичка", "тиквички",
    "cucumber", "pepino", "краставица", "краставици",
    "garlic", "ajo", "чесън",
    "garlic powder", "ajo en polvo", "чесън на прах",
    "olive oil", "extra virgin olive oil", "aceite de oliva", "aceite de oliva virgen", "зехтин",
    "sunflower oil", "aceite de girasol", "слънчогледово масло",
    "onion", "cebolla", "лук",
    "potato", "potatoes", "patata", "patatas", "картоф", "картофи",
    "carrot", "carrots", "zanahoria", "zanahorias", "морков", "моркови",
    "apple", "apples", "manzana", "manzanas", "ябълка", "ябълки",
    "banana", "bananas", "platano", "platanos", "банан", "банани",
    "orange", "oranges", "naranja", "naranjas", "портокал", "портокали",
    "spinach", "espinaca", "espinacas", "спанак",
    "lettuce", "lechuga", "маруля",
    "salt", "sal", "сол",
    "paprika", "pimenton", "червен пипер",
    "water", "agua", "вода",
    "sugar", "azucar", "захар",
    "salt and paprika", "sal y pimenton", "сол и червен пипер",
  ].map(normalizeIngredientName),
);

const RULE_BY_NAME = new Map<string, IngredientRule>();
for (const rule of RULES) {
  for (const name of rule.names) {
    RULE_BY_NAME.set(normalizeIngredientName(name), rule);
  }
}

function classifyIngredient(name: unknown): {
  name: string;
  detectedRestrictionIds: BalkanBiteFoodRestrictionId[];
  verifiability: "known" | "unverifiable";
} {
  if (typeof name !== "string" || !name.trim()) {
    return {
      name: "",
      detectedRestrictionIds: [],
      verifiability: "unverifiable",
    };
  }

  const trimmed = name.trim();
  const normalized = normalizeIngredientName(trimmed);
  const rule = RULE_BY_NAME.get(normalized);

  if (rule) {
    return {
      name: trimmed,
      detectedRestrictionIds: [...rule.restrictionIds],
      verifiability:
        rule.composition === "known" ? "known" : "unverifiable",
    };
  }

  if (SIMPLE_KNOWN_NON_ALLERGEN_NAMES.has(normalized)) {
    return {
      name: trimmed,
      detectedRestrictionIds: [],
      verifiability: "known",
    };
  }

  return {
    name: trimmed,
    detectedRestrictionIds: [],
    verifiability: "unverifiable",
  };
}

/**
 * Deterministic ingredient-name screening only.
 *
 * "no_match_detected" means only that no selected restriction was explicitly
 * detected in the declared ingredient names and every name was classifiable by
 * this narrow ruleset. It is NOT an allergen-safety claim. Cross-contact,
 * "may contain" statements, hidden compound ingredients, manufacturing data,
 * concentration thresholds and product-specific exemptions are outside this
 * evidence boundary and remain unknown. In particular, sulphur dioxide /
 * sulphites cannot become match_detected from a name alone because Annex II
 * applies a >10 mg/kg or >10 mg/l concentration threshold.
 */
export function screenRecipeFoodRestrictions(
  ingredients: readonly { name?: unknown }[] | undefined,
  restrictionIds: readonly BalkanBiteFoodRestrictionId[] | undefined,
): RecipeFoodRestrictionScreening {
  const selected = Array.from(
    new Set(
      (restrictionIds ?? []).filter((id) => ALL_RESTRICTION_IDS.has(id)),
    ),
  );
  const classified = (ingredients ?? []).map((ingredient) =>
    classifyIngredient(ingredient?.name),
  );

  const restrictionResults = selected.map((restrictionId) => {
    const matchedIngredients: string[] = [];
    const unverifiableIngredients: string[] = [];

    for (const ingredient of classified) {
      if (ingredient.detectedRestrictionIds.includes(restrictionId)) {
        matchedIngredients.push(ingredient.name);
      } else if (ingredient.verifiability === "unverifiable") {
        unverifiableIngredients.push(ingredient.name);
      }
    }

    const status: FoodRestrictionScreeningStatus =
      matchedIngredients.length > 0
        ? "match_detected"
        : unverifiableIngredients.length > 0
          ? "unverifiable"
          : "no_match_detected";

    return {
      restrictionId,
      status,
      matchedIngredients,
      unverifiableIngredients,
    };
  });

  const status: FoodRestrictionScreeningStatus =
    restrictionResults.some((result) => result.status === "match_detected")
      ? "match_detected"
      : restrictionResults.some((result) => result.status === "unverifiable")
        ? "unverifiable"
        : "no_match_detected";

  return {
    status,
    restrictionResults,
    evidenceScope: "declared_ingredient_names_only",
    crossContactEvidence: "unknown",
    establishesAllergenSafety: false,
  };
}

export function shouldBlockRecipeForFoodRestrictionScreening(
  screening: RecipeFoodRestrictionScreening,
): boolean {
  return screening.status === "match_detected";
}
