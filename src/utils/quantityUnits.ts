export type QuantityDimension =
  | "mass"
  | "volume"
  | "count"
  | "pack"
  | "bottle"
  | "can"
  | "jar"
  | "portion"
  | "fillet"
  | "tub"
  | "bunch"
  | "tablespoon"
  | "teaspoon"
  | "pinch"
  | `custom:${string}`;

export interface NormalizedUnit {
  raw: string;
  canonical: string;
  dimension: QuantityDimension;
  factorToBase: number;
  baseUnit: string;
  known: boolean;
}

export interface NormalizedQuantity {
  quantity: number;
  baseQuantity: number;
  unit: NormalizedUnit;
}

export type QuantityComparisonStatus =
  | "enough"
  | "insufficient"
  | "incompatible"
  | "invalid";

export interface QuantityComparison {
  status: QuantityComparisonStatus;
  available?: NormalizedQuantity;
  required?: NormalizedQuantity;
  shortfallBase?: number;
}

export interface QuantityLike {
  quantity: number;
  unit: string;
}

interface UnitDefinition {
  canonical: string;
  dimension: Exclude<QuantityDimension, `custom:${string}`>;
  factorToBase: number;
  baseUnit: string;
  aliases: string[];
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    canonical: "g",
    dimension: "mass",
    factorToBase: 1,
    baseUnit: "g",
    aliases: ["g", "gr", "gram", "grams", "gramo", "gramos", "г", "грам", "грама"],
  },
  {
    canonical: "kg",
    dimension: "mass",
    factorToBase: 1000,
    baseUnit: "g",
    aliases: ["kg", "kgs", "kilogram", "kilograms", "kilo", "kilos", "kilogramo", "kilogramos", "кг", "килограм", "килограма"],
  },
  {
    canonical: "ml",
    dimension: "volume",
    factorToBase: 1,
    baseUnit: "ml",
    aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "mililitro", "mililitros", "мл", "милилитър", "милилитра"],
  },
  {
    canonical: "l",
    dimension: "volume",
    factorToBase: 1000,
    baseUnit: "ml",
    aliases: ["l", "liter", "liters", "litre", "litres", "litro", "litros", "л", "литър", "литра"],
  },
  {
    canonical: "pcs",
    dimension: "count",
    factorToBase: 1,
    baseUnit: "pcs",
    aliases: ["pc", "pcs", "piece", "pieces", "item", "items", "unit", "units", "ud", "uds", "unidad", "unidades", "бр", "брой", "броя"],
  },
  {
    canonical: "pack",
    dimension: "pack",
    factorToBase: 1,
    baseUnit: "pack",
    aliases: ["pack", "packs", "packet", "packets", "paquete", "paquetes", "пакет", "пакета", "пакети"],
  },
  {
    canonical: "bottle",
    dimension: "bottle",
    factorToBase: 1,
    baseUnit: "bottle",
    aliases: ["bottle", "bottles", "botella", "botellas", "бутилка", "бутилки"],
  },
  {
    canonical: "can",
    dimension: "can",
    factorToBase: 1,
    baseUnit: "can",
    aliases: ["can", "cans", "lata", "latas", "tin", "tins", "консерва", "консерви"],
  },
  {
    canonical: "jar",
    dimension: "jar",
    factorToBase: 1,
    baseUnit: "jar",
    aliases: ["jar", "jars", "bote", "botes", "frasco", "frascos", "буркан", "буркани"],
  },
  {
    canonical: "portion",
    dimension: "portion",
    factorToBase: 1,
    baseUnit: "portion",
    aliases: ["portion", "portions", "porción", "porciones", "porcion", "porciones", "порция", "порции"],
  },
  {
    canonical: "fillet",
    dimension: "fillet",
    factorToBase: 1,
    baseUnit: "fillet",
    aliases: ["fillet", "fillets", "filete", "filetes", "филе", "филета"],
  },
  {
    canonical: "tub",
    dimension: "tub",
    factorToBase: 1,
    baseUnit: "tub",
    aliases: ["tub", "tubs", "tarrina", "tarrinas", "кофичка", "кофички"],
  },
  {
    canonical: "bunch",
    dimension: "bunch",
    factorToBase: 1,
    baseUnit: "bunch",
    aliases: ["bunch", "bunches", "manojo", "manojos", "връзка", "връзки"],
  },
  {
    canonical: "tbsp",
    dimension: "tablespoon",
    factorToBase: 1,
    baseUnit: "tbsp",
    aliases: ["tbsp", "tablespoon", "tablespoons", "cda", "cucharada", "cucharadas", "с л", "супена лъжица", "супени лъжици"],
  },
  {
    canonical: "tsp",
    dimension: "teaspoon",
    factorToBase: 1,
    baseUnit: "tsp",
    aliases: ["tsp", "teaspoon", "teaspoons", "cdta", "cucharadita", "cucharaditas", "ч л", "чаена лъжица", "чаени лъжици"],
  },
  {
    canonical: "pinch",
    dimension: "pinch",
    factorToBase: 1,
    baseUnit: "pinch",
    aliases: ["pinch", "pinches", "pizca", "pizcas", "щипка", "щипки"],
  },
];

const cleanUnit = (unit: string): string =>
  unit
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ");

const UNIT_LOOKUP = new Map<string, UnitDefinition>();
for (const definition of UNIT_DEFINITIONS) {
  for (const alias of definition.aliases) {
    UNIT_LOOKUP.set(cleanUnit(alias), definition);
  }
}

export function normalizeUnit(unit: string): NormalizedUnit | null {
  if (typeof unit !== "string") return null;
  const cleaned = cleanUnit(unit);
  if (!cleaned) return null;

  const definition = UNIT_LOOKUP.get(cleaned);
  if (definition) {
    return {
      raw: unit,
      canonical: definition.canonical,
      dimension: definition.dimension,
      factorToBase: definition.factorToBase,
      baseUnit: definition.baseUnit,
      known: true,
    };
  }

  return {
    raw: unit,
    canonical: cleaned,
    dimension: `custom:${cleaned}`,
    factorToBase: 1,
    baseUnit: cleaned,
    known: false,
  };
}

export function normalizeQuantity(
  quantity: number,
  unit: string
): NormalizedQuantity | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return null;

  return {
    quantity,
    baseQuantity: quantity * normalizedUnit.factorToBase,
    unit: normalizedUnit,
  };
}

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const a = normalizeUnit(unitA);
  const b = normalizeUnit(unitB);
  return Boolean(a && b && a.dimension === b.dimension);
}

export function compareQuantities(
  availableQuantity: number,
  availableUnit: string,
  requiredQuantity: number,
  requiredUnit: string
): QuantityComparison {
  const available = normalizeQuantity(availableQuantity, availableUnit);
  const required = normalizeQuantity(requiredQuantity, requiredUnit);

  if (!available || !required) {
    return { status: "invalid", available: available || undefined, required: required || undefined };
  }

  if (available.unit.dimension !== required.unit.dimension) {
    return { status: "incompatible", available, required };
  }

  const epsilon = 1e-9;
  if (available.baseQuantity + epsilon >= required.baseQuantity) {
    return { status: "enough", available, required, shortfallBase: 0 };
  }

  return {
    status: "insufficient",
    available,
    required,
    shortfallBase: required.baseQuantity - available.baseQuantity,
  };
}

export function assessTotalAvailability(
  availableItems: QuantityLike[],
  requiredQuantity: number,
  requiredUnit: string
): QuantityComparison {
  const required = normalizeQuantity(requiredQuantity, requiredUnit);
  if (!required) return { status: "invalid" };

  let compatibleBaseQuantity = 0;
  let foundCompatibleUnit = false;

  for (const item of availableItems) {
    const available = normalizeQuantity(item.quantity, item.unit);
    if (!available) continue;
    if (available.unit.dimension !== required.unit.dimension) continue;

    foundCompatibleUnit = true;
    compatibleBaseQuantity += available.baseQuantity;
  }

  if (!foundCompatibleUnit) {
    return { status: "incompatible", required };
  }

  const aggregateAvailable: NormalizedQuantity = {
    quantity: compatibleBaseQuantity / required.unit.factorToBase,
    baseQuantity: compatibleBaseQuantity,
    unit: required.unit,
  };

  const epsilon = 1e-9;
  if (compatibleBaseQuantity + epsilon >= required.baseQuantity) {
    return {
      status: "enough",
      available: aggregateAvailable,
      required,
      shortfallBase: 0,
    };
  }

  return {
    status: "insufficient",
    available: aggregateAvailable,
    required,
    shortfallBase: required.baseQuantity - compatibleBaseQuantity,
  };
}
