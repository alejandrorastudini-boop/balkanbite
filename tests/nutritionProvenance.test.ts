import { describe, expect, it } from "vitest";
import {
  aggregateNutritionValues,
  type NutritionValue,
} from "../src/utils/nutritionProvenance";

describe("aggregateNutritionValues", () => {
  it("keeps estimated and verified nutrient totals separate with their labels", () => {
    const values: NutritionValue[] = [
      {
        nutrient: "Protein",
        amount: 12,
        unit: "g",
        source: "product-label",
        status: "verified",
      },
      {
        nutrient: "Protein",
        amount: 5,
        unit: "g",
        source: "recipe-estimate",
        status: "estimated",
      },
      {
        nutrient: "Protein",
        amount: 3,
        unit: "g",
        source: "second-label",
        status: "verified",
      },
    ];

    const aggregation = aggregateNutritionValues(values);

    expect(aggregation.verifiedTotals).toEqual([
      {
        nutrient: "protein",
        amount: 15,
        unit: "g",
        status: "verified",
        sources: ["product-label", "second-label"],
      },
    ]);
    expect(aggregation.estimatedTotals).toEqual([
      {
        nutrient: "protein",
        amount: 5,
        unit: "g",
        status: "estimated",
        sources: ["recipe-estimate"],
      },
    ]);
  });

  it("keeps missing nutrition values unknown and does not combine incompatible units", () => {
    const values: NutritionValue[] = [
      {
        nutrient: "Energy",
        amount: 100,
        unit: "kcal",
        source: "product-label",
        status: "verified",
      },
      {
        nutrient: "Energy",
        amount: 418,
        unit: "kJ",
        source: "product-label",
        status: "verified",
      },
      {
        nutrient: "Fiber",
        amount: null,
        unit: "g",
        source: "recipe-estimate",
        status: "estimated",
      },
    ];

    const aggregation = aggregateNutritionValues(values);

    expect(aggregation.verifiedTotals).toEqual([
      {
        nutrient: "energy",
        amount: 100,
        unit: "kcal",
        status: "verified",
        sources: ["product-label"],
      },
      {
        nutrient: "energy",
        amount: 418,
        unit: "kj",
        status: "verified",
        sources: ["product-label"],
      },
    ]);
    expect(aggregation.unknownValues).toEqual([values[2]]);
  });
});
