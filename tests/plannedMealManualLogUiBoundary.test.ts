import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/MealPlanView.tsx", import.meta.url),
  "utf8",
);

test("planned meal can be logged only for the current local calendar day", () => {
  assert.match(source, /selectedDateStr === localCalendarDay/);
  assert.match(source, /Log as eaten/);
  assert.match(source, /Confirm eaten meal/);
  assert.match(source, /does not change pantry quantities/);
});

test("recipe nutrition is authoritative only when recipe status is verified", () => {
  assert.match(source, /recipe\.nutritionDataStatus === "verified"/);
  assert.match(source, /\.\.\.\(nutritionVerified \? \{/);
});

test("already matched planned recipe is not offered another log action", () => {
  assert.match(source, /consumption\.status !== "planned_recipe_logged"/);
});
