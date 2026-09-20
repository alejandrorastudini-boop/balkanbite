import assert from "node:assert/strict";
import test from "node:test";

import {
  getFoodSafetyQuarantine,
  isFoodSafetyReviewRequired,
} from "../src/utils/foodSafetyQuarantine";

test("legacy allergy/intolerance values require food-safety review without exposing values", () => {
  const result = getFoodSafetyQuarantine({
    allergies: ["Peanuts", "Lactose"],
    dietStyle: "mediterranean",
  });

  assert.deepEqual(result, {
    status: "review_required",
    reasons: ["legacy_allergy_or_intolerance"],
  });
  assert.equal(JSON.stringify(result).includes("Peanuts"), false);
  assert.equal(JSON.stringify(result).includes("Lactose"), false);
});

test("legacy gluten-free and keto diet labels are quarantined", () => {
  assert.deepEqual(getFoodSafetyQuarantine({ dietStyle: "gluten_free" }), {
    status: "review_required",
    reasons: ["legacy_gluten_free_diet"],
  });
  assert.deepEqual(getFoodSafetyQuarantine({ dietStyle: "keto" }), {
    status: "review_required",
    reasons: ["legacy_keto_diet"],
  });
});

test("ordinary culinary preferences remain clear", () => {
  for (const dietStyle of ["all", "mediterranean", "vegetarian", "vegan"]) {
    assert.deepEqual(getFoodSafetyQuarantine({ dietStyle }), {
      status: "clear",
      reasons: [],
    });
  }
});

test("server boundary accepts a minimal review marker and does not trust a clear marker over raw legacy profile", () => {
  assert.equal(
    isFoodSafetyReviewRequired({
      status: "review_required",
      reasons: ["legacy_allergy_or_intolerance"],
    }),
    true,
  );
  assert.equal(
    isFoodSafetyReviewRequired({
      status: "clear",
      reasons: [],
    }),
    false,
  );
  assert.equal(
    isFoodSafetyReviewRequired({ allergies: ["eggs"] }),
    true,
  );
});
