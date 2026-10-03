import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");

test("Firebase sync exposes owner hydration readiness for AI-relevant derived collections", () => {
  assert.match(hook, /recipesHydrated:[\s\S]*hydratedCollectionUser\.current\.recipes === currentUser\.uid/);
  assert.match(hook, /mealPlanHydrated:[\s\S]*hydratedCollectionUser\.current\.mealPlans === currentUser\.uid/);
  assert.match(hook, /shoppingHydrated:[\s\S]*hydratedCollectionUser\.current\.shoppingList === currentUser\.uid/);
});

test("AI generation is gated before fetch by the collection it will consume or mutate", () => {
  const cases = [
    ["const handleGenerateAiShopping", "/api/ai/suggest-shopping", 'requireWorkspaceAuthority(shoppingHydrated, "shopping")'],
    ["const handleGenerateAiRecipes", "/api/ai/generate-recipes", 'requireWorkspaceAuthority(recipesHydrated, "recipes")'],
    ["const handleGenerateAiWeekPlan", "/api/ai/generate-weekly-plan", 'requireWorkspaceAuthority(mealPlanHydrated, "mealPlan")'],
  ] as const;

  for (const [handler, endpoint, gate] of cases) {
    const start = app.indexOf(handler);
    const fetchAt = app.indexOf(endpoint, start);
    assert.ok(start >= 0 && fetchAt > start, handler);
    const block = app.slice(start, fetchAt);
    assert.ok(block.includes(gate), `${handler} missing ${gate}`);
  }
});

test("pantry-driven menu adaptation waits for recipe and meal-plan authority", () => {
  const start = app.indexOf("const handleAdaptMenuToPantry");
  const end = app.indexOf("const handleClearPantry", start);
  const block = app.slice(start, end);
  assert.match(block, /requireWorkspaceAuthority\(mealPlanHydrated, "mealPlan"\)/);
  assert.match(block, /requireWorkspaceAuthority\(recipesHydrated, "recipes"\)/);
});
