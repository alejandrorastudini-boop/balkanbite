import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("guest meal-plan startup uses the domain cache parser", () => {
  const start = appSource.indexOf("const [mealPlan, setMealPlan]");
  const end = appSource.indexOf("const [mealLogs", start);
  assert.ok(start >= 0 && end > start);

  const initializer = appSource.slice(start, end);
  assert.match(initializer, /parseStoredMealPlanCache/);
  assert.match(initializer, /\?\?\s*DEFAULT_MEAL_PLAN/);
  assert.doesNotMatch(initializer, /JSON\.parse/);
});

test("guest workspace meal-plan rehydration no longer uses the generic array cast", () => {
  assert.match(
    appSource,
    /parseStoredMealPlanCache\(localStorage\.getItem\("balkanbite_mealplan"\)\)/,
  );
  assert.doesNotMatch(appSource, /parseArrayCache<MealPlanDay>/);
});

test("cloud meal-plan snapshots use the persisted day structure predicate", () => {
  assert.match(
    syncSource,
    /isStoredMealPlanDayStructurallyValid.*storedMealPlanValidation/,
  );
  assert.match(
    syncSource,
    /syncCollection\(\s*"mealPlans",\s*mealPlan,\s*setMealPlan,\s*\(\) => true,\s*true,\s*isStoredMealPlanDayStructurallyValid\s*\)/,
  );
});

test("remote filtering still occurs before canonical document tracking", () => {
  const acceptanceIndex = syncSource.indexOf(
    ".filter(({ item }) => shouldAcceptRemoteItem(item))",
  );
  const trackingIndex = syncSource.indexOf(
    "hydratedCollectionDocumentIds.current[collectionName] = new Set(",
    acceptanceIndex,
  );

  assert.ok(acceptanceIndex >= 0);
  assert.ok(trackingIndex > acceptanceIndex);
});
