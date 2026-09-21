import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const recipeViewSource = readFileSync(
  new URL("../src/components/RecipeView.tsx", import.meta.url),
  "utf8"
);
const typesSource = readFileSync(new URL("../src/types.ts", import.meta.url), "utf8");
const provenanceSource = readFileSync(
  new URL("../src/utils/aiRecipeProvenance.ts", import.meta.url),
  "utf8"
);

test("AI recipe nutrition and cost carry explicit estimate provenance", () => {
  assert.match(provenanceSource, /nutritionDataStatus:\s*"estimated"/);
  assert.match(provenanceSource, /costDataStatus:\s*"estimated"/);
  assert.match(provenanceSource, /healthScore:\s*_discardedHealthScore/);
  assert.match(serverSource, /applyAiRecipeEstimateProvenance/);
  assert.match(
    serverSource,
    /Estimate cost per serving for planning only\. It is NOT live, exact, or verified market pricing/
  );
  assert.match(serverSource, /nutrition highlights are estimates only/);
});

test("recipe UI never presents unverified nutrition or cost as exact", () => {
  assert.match(typesSource, /nutritionDataStatus\?: "verified" \| "estimated" \| "unknown"/);
  assert.match(typesSource, /costDataStatus\?: "verified" \| "estimated" \| "unknown"/);
  assert.match(recipeViewSource, /isNutritionVerified\(recipe\) \? "" : "≈"/);
  assert.match(recipeViewSource, /formatRecipeCostEUR\(/);
  assert.match(recipeViewSource, /recipeCostCurrencyNotice\(currency, language\)/);
  assert.match(
    recipeViewSource,
    /Nutrition and cost are shown as estimates; they are not verified calculations/
  );
  assert.doesNotMatch(
    recipeViewSource,
    /costPerServingEUR\s*\*\s*1\.1/
  );
});
