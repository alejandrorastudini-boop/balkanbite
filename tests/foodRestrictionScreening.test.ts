import assert from "node:assert/strict";
import test from "node:test";

import {
  screenRecipeFoodRestrictions,
  shouldBlockRecipeForFoodRestrictionScreening,
} from "../src/utils/foodRestrictionScreening";

test("explicit Annex II ingredient match blocks the recommendation", () => {
  const result = screenRecipeFoodRestrictions(
    [{ name: "Huevos frescos" }, { name: "Tomate" }],
    ["eu_annex_ii:eggs"],
  );

  assert.equal(result.status, "match_detected");
  assert.equal(shouldBlockRecipeForFoodRestrictionScreening(result), true);
  assert.deepEqual(result.restrictionResults[0]?.matchedIngredients, [
    "Huevos frescos",
  ]);
  assert.equal(result.establishesAllergenSafety, false);
  assert.equal(result.crossContactEvidence, "unknown");
});

test("English, Spanish and Bulgarian Annex II cereal names map deterministically to gluten", () => {
  for (const name of ["wheat", "centeno", "ечемик", "овес"]) {
    const result = screenRecipeFoodRestrictions(
      [{ name }],
      ["eu_annex_ii:cereals_containing_gluten"],
    );
    assert.equal(result.status, "match_detected", name);
  }
});

test("Annex II named nuts are explicit matches", () => {
  for (const name of ["almond", "pistacho", "лешник", "macadamia"]) {
    const result = screenRecipeFoodRestrictions(
      [{ name }],
      ["eu_annex_ii:nuts"],
    );
    assert.equal(result.status, "match_detected", name);
  }
});

test("processed known product can match its explicit allergen but stays unverifiable for other restrictions", () => {
  const milk = screenRecipeFoodRestrictions(
    [{ name: "Queso" }],
    ["eu_annex_ii:milk"],
  );
  assert.equal(milk.status, "match_detected");

  const eggs = screenRecipeFoodRestrictions(
    [{ name: "Queso" }],
    ["eu_annex_ii:eggs"],
  );
  assert.equal(eggs.status, "unverifiable");
  assert.deepEqual(eggs.restrictionResults[0]?.unverifiableIngredients, [
    "Queso",
  ]);
});

test("unknown or compound ingredient names are unverifiable rather than assumed safe", () => {
  for (const name of ["Pasta", "house sauce", "mystery seasoning"]) {
    const result = screenRecipeFoodRestrictions(
      [{ name }],
      ["eu_annex_ii:cereals_containing_gluten"],
    );
    assert.equal(result.status, "unverifiable", name);
    assert.equal(shouldBlockRecipeForFoodRestrictionScreening(result), false);
  }
});

test("no_match_detected is limited to classifiable declared ingredient names and never claims safety", () => {
  const result = screenRecipeFoodRestrictions(
    [{ name: "Tomate" }, { name: "Arroz" }, { name: "Aceite de oliva" }],
    ["eu_annex_ii:milk", "eu_annex_ii:eggs"],
  );

  assert.equal(result.status, "no_match_detected");
  assert.equal(result.establishesAllergenSafety, false);
  assert.equal(result.crossContactEvidence, "unknown");
  assert.equal(shouldBlockRecipeForFoodRestrictionScreening(result), false);
});

test("lactose is separate from milk allergy while explicit milk screens against both", () => {
  const explicitMilk = screenRecipeFoodRestrictions(
    [{ name: "Milk" }],
    ["intolerance:lactose"],
  );
  assert.equal(explicitMilk.status, "match_detected");

  const cheese = screenRecipeFoodRestrictions(
    [{ name: "Parmesano" }],
    ["intolerance:lactose"],
  );
  assert.equal(cheese.status, "unverifiable");
});

test("a match wins aggregate status even when another selected restriction is unverifiable", () => {
  const result = screenRecipeFoodRestrictions(
    [{ name: "Queso" }],
    ["eu_annex_ii:milk", "eu_annex_ii:eggs"],
  );

  assert.equal(result.status, "match_detected");
  assert.equal(
    result.restrictionResults.find((item) => item.restrictionId === "eu_annex_ii:milk")?.status,
    "match_detected",
  );
  assert.equal(
    result.restrictionResults.find((item) => item.restrictionId === "eu_annex_ii:eggs")?.status,
    "unverifiable",
  );
});
