import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("server-confirmed stock reconciliation waits for recipe and meal-plan authority", () => {
  const generic = app.indexOf("pendingSignedInDerivedReconciliations.current.size");
  const purchase = app.indexOf("const finalizeSignedInPurchaseIfVisible");
  const creation = app.indexOf("const pending = pendingSignedInCreations.current");
  const voice = app.indexOf("pendingSignedInVoiceConsumptions.current.size");
  for (const start of [generic, purchase, creation, voice]) {
    assert.ok(start >= 0);
    const block = app.slice(start, start + 2400);
    assert.match(block, /!recipesHydrated \|\| !mealPlanHydrated/);
  }
});

test("derived hydration changes retrigger pending stock reconciliation effects", () => {
  const dependencies = app.match(/\[\s*pantry,\s*currentUser,\s*inventoryHydrated,\s*inventoryServerConfirmed,\s*recipesHydrated,\s*mealPlanHydrated,\s*\]/g) ?? [];
  assert.ok(dependencies.length >= 4, "all stock-driven derived effects must retry when derived authority arrives");
});

test("purchase evidence is retained while derived collections are not authoritative", () => {
  const start = app.indexOf("const finalizeSignedInPurchaseIfVisible");
  const clear = app.indexOf("pendingSignedInPurchaseApplication.current = null", start);
  const authority = app.indexOf("if (!recipesHydrated || !mealPlanHydrated) return false", start);
  assert.ok(start >= 0 && authority > start && clear > authority);
});
