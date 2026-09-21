import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECIPES } from "../src/data/initialData";
import {
  isStoredMealPlanDayStructurallyValid,
  parseStoredMealPlanCache,
} from "../src/utils/storedMealPlanValidation";

const recipe = SAMPLE_RECIPES[0];

test("real ISO calendar dates with valid optional meals are accepted", () => {
  assert.ok(recipe);

  assert.equal(
    isStoredMealPlanDayStructurallyValid({
      date: "2026-09-21",
      breakfast: recipe,
    }),
    true,
  );
  assert.equal(
    isStoredMealPlanDayStructurallyValid({ date: "2026-09-21" }),
    true,
  );
});

test("invalid or normalized calendar dates are rejected", () => {
  for (const date of [
    "",
    "2026-9-21",
    "2026/09/21",
    "not-a-date",
    "2026-02-30",
    "2026-13-01",
  ]) {
    assert.equal(
      isStoredMealPlanDayStructurallyValid({ date }),
      false,
      `expected invalid date ${date}`,
    );
  }
});

test("every present planned meal must satisfy the stored recipe boundary", () => {
  assert.ok(recipe);

  assert.equal(
    isStoredMealPlanDayStructurallyValid({
      date: "2026-09-21",
      lunch: { id: "broken-recipe" },
    }),
    false,
  );
  assert.equal(
    isStoredMealPlanDayStructurallyValid({
      date: "2026-09-21",
      dinner: null,
    }),
    false,
  );
  assert.equal(
    isStoredMealPlanDayStructurallyValid({
      date: "2026-09-21",
      breakfast: recipe,
      lunch: recipe,
      dinner: recipe,
    }),
    true,
  );
});

test("mixed persisted plan cache quarantines only malformed day rows", () => {
  assert.ok(recipe);
  const validDay = { date: "2026-09-21", dinner: recipe };
  const emptyValidDay = { date: "2026-09-22" };

  const parsed = parseStoredMealPlanCache(
    JSON.stringify([
      validDay,
      { date: "2026-02-30", lunch: recipe },
      { date: "2026-09-23", lunch: { id: "broken" } },
      emptyValidDay,
    ]),
  );

  assert.deepEqual(parsed, [validDay, emptyValidDay]);
});

test("valid stored nested recipe provenance remains unchanged", () => {
  assert.ok(recipe);
  const verifiedRecipe = {
    ...recipe,
    nutritionDataStatus: "verified" as const,
    costDataStatus: "unknown" as const,
  };
  const day = { date: "2026-09-21", breakfast: verifiedRecipe };

  const parsed = parseStoredMealPlanCache(JSON.stringify([day]));

  assert.equal(parsed?.[0]?.breakfast?.nutritionDataStatus, "verified");
  assert.equal(parsed?.[0]?.breakfast?.costDataStatus, "unknown");
});

test("missing or malformed top-level plan cache remains unresolved", () => {
  assert.equal(parseStoredMealPlanCache(null), null);
  assert.equal(parseStoredMealPlanCache("{bad json"), null);
  assert.equal(parseStoredMealPlanCache(JSON.stringify({ date: "2026-09-21" })), null);
});
