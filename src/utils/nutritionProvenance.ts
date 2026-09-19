export type NutritionValueStatus = "estimated" | "verified";

/** A declared source, such as a product label, recipe, or meal log. */
export type NutritionValueSource = string;

/** Incomplete declarations remain representable without substituting a value. */
export interface NutritionValue {
  nutrient: string;
  amount?: number | null;
  unit?: string | null;
  source: NutritionValueSource;
  status: NutritionValueStatus;
}

export interface NutritionTotal {
  nutrient: string;
  amount: number;
  unit: string;
  status: NutritionValueStatus;
  sources: NutritionValueSource[];
}

export interface NutritionAggregation {
  /** Totals made exclusively from values declared as verified. */
  verifiedTotals: NutritionTotal[];
  /** Estimated values are always kept separate from verified totals. */
  estimatedTotals: NutritionTotal[];
  /** Values that cannot safely be totalled because a required field is unknown. */
  unknownValues: NutritionValue[];
}

const normaliseLabel = (value: string) => value.trim().toLocaleLowerCase();

const isKnownValue = (
  value: NutritionValue,
): value is NutritionValue & { amount: number; unit: string } =>
  typeof value.amount === "number" &&
  Number.isFinite(value.amount) &&
  value.amount >= 0 &&
  typeof value.unit === "string" &&
  value.unit.trim().length > 0 &&
  value.nutrient.trim().length > 0 &&
  value.source.trim().length > 0;

const addToTotals = (
  totals: Map<string, NutritionTotal>,
  value: NutritionValue & { amount: number; unit: string },
) => {
  // Unit is part of the key: unlike units are never converted or combined.
  const nutrient = normaliseLabel(value.nutrient);
  const unit = normaliseLabel(value.unit);
  const key = `${nutrient}\u0000${unit}`;
  const current = totals.get(key);

  if (current) {
    current.amount += value.amount;
    if (!current.sources.includes(value.source)) current.sources.push(value.source);
    return;
  }

  totals.set(key, {
    nutrient,
    amount: value.amount,
    unit,
    status: value.status,
    sources: [value.source],
  });
};

/**
 * Separates verified and estimated declarations before aggregation. Missing
 * data stays unknown; estimates never contribute to a verified total.
 */
export const aggregateNutritionValues = (
  values: readonly NutritionValue[],
): NutritionAggregation => {
  const verifiedTotals = new Map<string, NutritionTotal>();
  const estimatedTotals = new Map<string, NutritionTotal>();
  const unknownValues: NutritionValue[] = [];

  for (const value of values) {
    if (!isKnownValue(value)) {
      unknownValues.push(value);
      continue;
    }

    addToTotals(value.status === "verified" ? verifiedTotals : estimatedTotals, value);
  }

  return {
    verifiedTotals: [...verifiedTotals.values()],
    estimatedTotals: [...estimatedTotals.values()],
    unknownValues,
  };
};
