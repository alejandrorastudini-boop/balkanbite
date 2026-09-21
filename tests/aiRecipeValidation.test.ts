import assert from "node:assert/strict";
import test from "node:test";
import { applyAiRecipeEstimateProvenance } from "../src/utils/aiRecipeProvenance";
import { validateAiRecipeStructure } from "../src/utils/aiRecipeValidation";

const completeRecipe = {
  id: "recipe-1",
  title: { en: "Bean soup", bg: "Боб чорба", es: "Sopa de judías" },
  description: {
    en: "A simple bean soup.",
    bg: "Проста боб чорба.",
    es: "Una sopa sencilla de judías.",
  },
  prepTimeMin: 10,
  cookTimeMin: 30,
  costPerServingEUR: 2.5,
  difficulty: "easy",
  servings: 2,
  calories: 350,
  proteinG: 18,
  carbsG: 48,
  fatG: 7,
  fiberG: 12,
  healthScore: 99,
  nutritionDataStatus: "verified",
  costDataStatus: "verified",
  tags: ["Balkan", "Budget"],
  ingredients: [
    { name: "Beans", amount: 200, unit: "g", inPantry: true },
    { name: "Onion", amount: 1, unit: "pcs", inPantry: false },
  ],
  instructions: {
    en: ["Rinse the beans.", "Cook until tender."],
    bg: ["Измийте боба.", "Сварете до омекване."],
    es: ["Lava las judías.", "Cuece hasta que estén tiernas."],
  },
  nutritionHighlights: {
    en: "Estimated planning nutrition.",
    bg: "Приблизителни хранителни стойности.",
    es: "Nutrición estimada para planificación.",
  },
};

function normalized(candidate: unknown, fallbackId = "fallback-id") {
  return validateAiRecipeStructure(
    applyAiRecipeEstimateProvenance(candidate),
    fallbackId,
  );
}

test("complete AI recipe passes only after provenance is downgraded", () => {
  assert.equal(validateAiRecipeStructure(completeRecipe), null);

  const result = normalized(completeRecipe);
  assert.ok(result);
  assert.equal(result?.nutritionDataStatus, "estimated");
  assert.equal(result?.costDataStatus, "estimated");
  assert.equal(result?.id, "recipe-1");
  assert.equal(result?.ingredients.length, 2);
  assert.equal("healthScore" in result!, false);
});

test("missing model id may use caller-provided internal fallback only", () => {
  const { id: _id, ...withoutId } = completeRecipe;
  const result = normalized(withoutId, "ai-rec-0");
  assert.equal(result?.id, "ai-rec-0");
  assert.equal(normalized(withoutId, ""), null);
});

test("missing structural recipe fields are rejected instead of defaulted", () => {
  for (const key of [
    "title",
    "description",
    "prepTimeMin",
    "cookTimeMin",
    "costPerServingEUR",
    "difficulty",
    "servings",
    "calories",
    "proteinG",
    "carbsG",
    "fatG",
    "fiberG",
    "tags",
    "ingredients",
    "instructions",
    "nutritionHighlights",
  ] as const) {
    const candidate = { ...completeRecipe } as Record<string, unknown>;
    delete candidate[key];
    assert.equal(normalized(candidate), null, `expected missing ${key} to fail`);
  }
});

test("invalid numeric recipe values never cross the boundary", () => {
  for (const [field, value] of [
    ["calories", Number.NaN],
    ["proteinG", Number.POSITIVE_INFINITY],
    ["carbsG", -1],
    ["costPerServingEUR", -0.01],
    ["servings", 0],
    ["prepTimeMin", -1],
  ] as const) {
    assert.equal(
      normalized({ ...completeRecipe, [field]: value }),
      null,
      `expected invalid ${field} to fail`,
    );
  }
});

test("ingredients require explicit positive amount unit name and boolean pantry flag", () => {
  const invalidIngredients = [
    [{ name: "Beans", amount: 0, unit: "g", inPantry: true }],
    [{ name: "", amount: 100, unit: "g", inPantry: true }],
    [{ name: "Beans", amount: 100, unit: "", inPantry: true }],
    [{ name: "Beans", amount: 100, unit: "g" }],
    [],
  ];

  for (const ingredients of invalidIngredients) {
    assert.equal(normalized({ ...completeRecipe, ingredients }), null);
  }
});

test("localized text and instructions must be complete without invented translations", () => {
  assert.equal(
    normalized({
      ...completeRecipe,
      title: { en: "Soup", bg: "Супа" },
    }),
    null,
  );
  assert.equal(
    normalized({
      ...completeRecipe,
      instructions: {
        en: ["Cook"],
        bg: ["Гответе"],
        es: [],
      },
    }),
    null,
  );
});
