import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const translationsSource = fs.readFileSync(
  new URL("../src/utils/translations.ts", import.meta.url),
  "utf8",
);

test("clearing the meal plan preserves recorded consumption history", () => {
  const start = appSource.indexOf("const handleClearMealPlan");
  const end = appSource.indexOf("const [isGeneratingPlan", start);
  assert.ok(start >= 0 && end > start);

  const handler = appSource.slice(start, end);
  assert.match(handler, /setMealPlan\(\[\]\)/);
  assert.doesNotMatch(handler, /setMealLogs\(\[\]\)/);
});

test("meal-plan clear confirmation explicitly preserves meal history in EN ES BG", () => {
  assert.match(
    translationsSource,
    /Your recorded meal history will be kept\./,
  );
  assert.match(
    translationsSource,
    /Se conservará el historial de comidas registradas\./,
  );
  assert.match(
    translationsSource,
    /Записаната история на храненията ще бъде запазена\./,
  );
});

test("meal-plan clear copy no longer claims nutrition logs are deleted", () => {
  const relevant = translationsSource
    .split("\n")
    .filter((line) => line.includes("mealPlanClearConfirm"))
    .join("\n");

  assert.doesNotMatch(relevant, /nutrition logs|registros de nutrición|записаните питания/i);
});
