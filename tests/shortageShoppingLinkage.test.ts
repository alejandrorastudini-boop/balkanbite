import { describe, expect, it } from "vitest";
import {
  reconcileShortageShoppingLines,
  type ConfirmedShortage,
  type ShoppingLine,
} from "../src/utils/shortageShoppingLinkage";

const flourShortage: ConfirmedShortage = {
  id: "weekly-plan:flour",
  name: "Flour",
  quantity: 500,
  unit: "g",
};

describe("reconcileShortageShoppingLines", () => {
  it("adds each confirmed shortage once with stable provenance and unknown price", () => {
    const lines = reconcileShortageShoppingLines([], [flourShortage, flourShortage]);

    expect(lines).toEqual([
      {
        id: "shortage:weekly-plan:flour",
        name: "Flour",
        quantity: 500,
        unit: "g",
        source: "plan-shortage",
        shortageId: "weekly-plan:flour",
        estimatedPriceEUR: undefined,
      },
    ]);
  });

  it("reconciles a source-derived line when its shortage changes", () => {
    const existing: ShoppingLine[] = [
      {
        id: "shortage:weekly-plan:flour",
        name: "Flour",
        quantity: 200,
        unit: "g",
        source: "plan-shortage",
        shortageId: "weekly-plan:flour",
        estimatedPriceEUR: undefined,
      },
    ];

    expect(reconcileShortageShoppingLines(existing, [flourShortage])).toMatchObject([
      { quantity: 500, shortageId: "weekly-plan:flour", estimatedPriceEUR: undefined },
    ]);
  });

  it("preserves manual lines and excludes unresolved shortage fields", () => {
    const manual: ShoppingLine = {
      id: "manual:coffee",
      name: "Coffee",
      quantity: 1,
      unit: "bag",
      source: "manual",
      estimatedPriceEUR: 7.5,
    };
    const unresolved = { id: "weekly-plan:milk", name: "Milk", quantity: 0, unit: "ml" };

    expect(reconcileShortageShoppingLines([manual], [unresolved])).toEqual([manual]);
  });
});
