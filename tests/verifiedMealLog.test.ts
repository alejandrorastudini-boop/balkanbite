import assert from "node:assert/strict";
import test from "node:test";
import { buildVerifiedMealLog } from "../src/utils/verifiedMealLog";

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
