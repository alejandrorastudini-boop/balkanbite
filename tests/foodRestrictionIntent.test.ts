import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfirmedRestrictionIds,
  validateFoodRestrictionIntent,
} from "../src/utils/foodRestrictionIntent";

const confirmedAt = "2026-10-07T12:00:00.000Z";

test("canonical restriction intent keeps transient use separate from persistence", () => {
  const result = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: [{
      restrictionId: "eu_annex_ii:peanuts",
      kind: "allergy",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    }],
  });

  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.equal(result.value.useIntent, "use_once");
  assert.deepEqual(getConfirmedRestrictionIds(result.value), ["eu_annex_ii:peanuts"]);
});

test("save intent is explicit rather than inferred from confirmation", () => {
  const result = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "save_to_profile",
    restrictions: [{
      restrictionId: "eu_annex_ii:milk",
      kind: "allergy",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    }],
  });
  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.equal(result.value.useIntent, "save_to_profile");
});

test("unconfirmed or inferred-looking restrictions fail closed", () => {
  for (const confirmedByUser of [false, undefined]) {
    const result = validateFoodRestrictionIntent({
      version: 1,
      purpose: "food_recommendation_safety_screening_v1",
      useIntent: "use_once",
      restrictions: [{
        restrictionId: "eu_annex_ii:eggs",
        kind: "allergy",
        confirmedByUser,
        confirmedAt,
        source: "self_reported",
      }],
    });
    assert.deepEqual(result, { status: "invalid", reason: "invalid_restriction" });
  }
});

test("lactose intolerance cannot silently become milk allergy semantics", () => {
  const invalid = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: [{
      restrictionId: "intolerance:lactose",
      kind: "allergy",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    }],
  });
  assert.deepEqual(invalid, { status: "invalid", reason: "invalid_restriction" });

  const valid = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: [{
      restrictionId: "intolerance:lactose",
      kind: "intolerance",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    }],
  });
  assert.equal(valid.status, "valid");
});

test("unknown canonical IDs and duplicate declarations fail closed", () => {
  const unknown = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: [{
      restrictionId: "allergy:shellfish",
      kind: "allergy",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    }],
  });
  assert.deepEqual(unknown, { status: "invalid", reason: "invalid_restriction" });

  const duplicate = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: [0, 1].map(() => ({
      restrictionId: "eu_annex_ii:nuts",
      kind: "allergy",
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    })),
  });
  assert.deepEqual(duplicate, { status: "invalid", reason: "duplicate_restriction" });
});

test("restriction intent requires an exact versioned purpose and ISO provenance time", () => {
  assert.deepEqual(
    validateFoodRestrictionIntent({
      version: 1,
      purpose: "general_health",
      useIntent: "use_once",
      restrictions: [],
    }),
    { status: "invalid", reason: "invalid_purpose" },
  );

  assert.deepEqual(
    validateFoodRestrictionIntent({
      version: 1,
      purpose: "food_recommendation_safety_screening_v1",
      useIntent: "use_once",
      restrictions: [{
        restrictionId: "eu_annex_ii:fish",
        kind: "allergy",
        confirmedByUser: true,
        confirmedAt: "today",
        source: "self_reported",
      }],
    }),
    { status: "invalid", reason: "invalid_restriction" },
  );
});

test("same canonical restriction with conflicting kinds is not accepted twice", () => {
  const result = validateFoodRestrictionIntent({
    version: 1,
    purpose: "food_recommendation_safety_screening_v1",
    useIntent: "use_once",
    restrictions: ["allergy", "intolerance"].map((kind) => ({
      restrictionId: "eu_annex_ii:milk",
      kind,
      confirmedByUser: true,
      confirmedAt,
      source: "self_reported",
    })),
  });
  assert.deepEqual(result, { status: "invalid", reason: "duplicate_restriction" });
});
