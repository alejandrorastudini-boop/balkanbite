import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVerifiedMealLog,
  parseMealLogCache,
  sanitizeStoredMealLog,
} from "../src/utils/verifiedMealLog";

const base = {
  id: "log-1",
  date: "2026-09-20",
  timestamp: "2026-09-20T17:20:00.000Z",
  mealType: "dinner",
  manualName: "  Dinner  ",
  nutritionVerified: true,
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
};

test("verified complete nutrition is preserved exactly", () => {
  assert.deepEqual(buildVerifiedMealLog(base), {
    id: "log-1",
    date: "2026-09-20",
    mealType: "dinner",
    manualName: "Dinner",
    nutritionDataStatus: "verified",
    calories: 500,
    proteinG: 30,
    carbsG: 60,
    fatG: 15,
    timestamp: "2026-09-20T17:20:00.000Z",
  });
});

test("explicit verified zero values remain valid", () => {
  const result = buildVerifiedMealLog({
    ...base,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
  assert.ok(result);
  assert.equal(result?.calories, 0);
  assert.equal(result?.proteinG, 0);
});

test("unverified nutrition is rejected", () => {
  assert.equal(
    buildVerifiedMealLog({ ...base, nutritionVerified: false }),
    null,
  );
  assert.equal(
    buildVerifiedMealLog({ ...base, nutritionVerified: undefined }),
    null,
  );
});

test("missing nutrition never defaults to zero", () => {
  for (const field of ["calories", "proteinG", "carbsG", "fatG"] as const) {
    const candidate = { ...base };
    delete (candidate as any)[field];
    assert.equal(buildVerifiedMealLog(candidate), null);
  }
});

test("negative or non-finite nutrition is rejected", () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(buildVerifiedMealLog({ ...base, calories: value }), null);
    assert.equal(buildVerifiedMealLog({ ...base, proteinG: value }), null);
  }
});

test("meal type must be explicit and recognized", () => {
  assert.equal(buildVerifiedMealLog({ ...base, mealType: "brunch" }), null);
  assert.equal(buildVerifiedMealLog({ ...base, mealType: undefined }), null);
});

test("optional identity fields remain absent when not supplied", () => {
  const result = buildVerifiedMealLog({
    ...base,
    manualName: "   ",
    recipeId: undefined,
  });
  assert.ok(result);
  assert.equal(result?.manualName, undefined);
  assert.equal(result?.recipeId, undefined);
});

test("invalid date or timestamp rejects the log", () => {
  assert.equal(buildVerifiedMealLog({ ...base, date: "today" }), null);
  assert.equal(
    buildVerifiedMealLog({
      ...base,
      timestamp: "2026-09-20T17:20:00",
    }),
    null,
  );
});


test("legacy unknown zero nutrition preserves meal history but removes invented numbers", () => {
  const result = sanitizeStoredMealLog({
    id: "legacy-1",
    date: "2026-09-19",
    timestamp: "2026-09-19T18:00:00.000Z",
    mealType: "dinner",
    manualName: "Soup",
    nutritionDataStatus: "unknown",
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });

  assert.deepEqual(result, {
    id: "legacy-1",
    date: "2026-09-19",
    mealType: "dinner",
    manualName: "Soup",
    nutritionDataStatus: "unknown",
    timestamp: "2026-09-19T18:00:00.000Z",
  });
  assert.equal("calories" in (result ?? {}), false);
  assert.equal("proteinG" in (result ?? {}), false);
});

test("stored verified complete nutrition is preserved exactly", () => {
  const result = sanitizeStoredMealLog({
    id: "verified-cache-1",
    date: "2026-09-19",
    timestamp: "2026-09-19T12:00:00+03:00",
    mealType: "lunch",
    recipeId: "recipe-1",
    nutritionDataStatus: "verified",
    calories: 420,
    proteinG: 20,
    carbsG: 55,
    fatG: 12,
  });

  assert.deepEqual(result, {
    id: "verified-cache-1",
    date: "2026-09-19",
    mealType: "lunch",
    recipeId: "recipe-1",
    nutritionDataStatus: "verified",
    calories: 420,
    proteinG: 20,
    carbsG: 55,
    fatG: 12,
    timestamp: "2026-09-19T12:00:00+03:00",
  });
});

test("stored verified label with incomplete nutrition degrades to unknown", () => {
  const result = sanitizeStoredMealLog({
    id: "broken-verified",
    date: "2026-09-19",
    timestamp: "2026-09-19T12:00:00.000Z",
    mealType: "lunch",
    nutritionDataStatus: "verified",
    calories: 420,
    proteinG: 20,
    carbsG: 55,
  });

  assert.deepEqual(result, {
    id: "broken-verified",
    date: "2026-09-19",
    mealType: "lunch",
    nutritionDataStatus: "unknown",
    timestamp: "2026-09-19T12:00:00.000Z",
  });
});

test("estimated cache rows preserve provenance label but not numeric macros", () => {
  const result = sanitizeStoredMealLog({
    id: "estimated-1",
    date: "2026-09-19",
    timestamp: "2026-09-19T08:00:00.000Z",
    mealType: "breakfast",
    nutritionDataStatus: "estimated",
    calories: 350,
    proteinG: 12,
    carbsG: 45,
    fatG: 10,
  });

  assert.deepEqual(result, {
    id: "estimated-1",
    date: "2026-09-19",
    mealType: "breakfast",
    nutritionDataStatus: "estimated",
    timestamp: "2026-09-19T08:00:00.000Z",
  });
});

test("meal-log cache parser sanitizes rows and drops structurally invalid history", () => {
  const raw = JSON.stringify([
    {
      id: "valid-history",
      date: "2026-09-18",
      timestamp: "2026-09-18T19:00:00.000Z",
      mealType: "dinner",
      manualName: " Dinner ",
      nutritionDataStatus: "unknown",
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    },
    {
      id: "",
      date: "today",
      timestamp: "invalid",
      mealType: "brunch",
    },
  ]);

  assert.deepEqual(parseMealLogCache(raw), [
    {
      id: "valid-history",
      date: "2026-09-18",
      mealType: "dinner",
      manualName: "Dinner",
      nutritionDataStatus: "unknown",
      timestamp: "2026-09-18T19:00:00.000Z",
    },
  ]);
  assert.deepEqual(parseMealLogCache("not-json"), []);
  assert.deepEqual(parseMealLogCache('{"logs":[]}'), []);
  assert.deepEqual(parseMealLogCache(null), []);
});


test("stored verified label with invalid numeric nutrition degrades to unknown", () => {
  for (const calories of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = sanitizeStoredMealLog({
      id: "invalid-stored-verified",
      date: "2026-09-19",
      timestamp: "2026-09-19T12:00:00.000Z",
      mealType: "lunch",
      nutritionDataStatus: "verified",
      calories,
      proteinG: 20,
      carbsG: 55,
      fatG: 10,
    });

    assert.deepEqual(result, {
      id: "invalid-stored-verified",
      date: "2026-09-19",
      mealType: "lunch",
      nutritionDataStatus: "unknown",
      timestamp: "2026-09-19T12:00:00.000Z",
    });
  }
});
