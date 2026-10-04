import assert from "node:assert/strict";
import test from "node:test";
import { adaptMealPlanToPantry } from "../src/utils/menuAutoPlanner";
import { SAMPLE_RECIPES } from "../src/data/initialData";

test("adapted weekly plan starts on injected local calendar date", () => {
  const result = adaptMealPlanToPantry(
    [],
    [SAMPLE_RECIPES[0]],
    [],
    undefined,
    new Date(2026, 9, 5, 0, 30, 0, 0),
  );
  assert.equal(result.newPlan[0]?.date, "2026-10-05");
  assert.equal(result.newPlan[6]?.date, "2026-10-11");
});
