import assert from "node:assert/strict";
import test from "node:test";
import { screenWithTransientFoodRestrictionIntent as screen } from "../src/utils/transientFoodRestrictionScreening";

const restriction = { restrictionId: "eu_annex_ii:peanuts", kind: "allergy", confirmedByUser: true, confirmedAt: "2026-10-08T00:00:00.000Z", source: "self_reported" };
const intent = (useIntent: string, restrictions: unknown[] = [restriction]) => ({ version: 1, purpose: "food_recommendation_safety_screening_v1", useIntent, restrictions });

test("confirmed transient restriction detects matches without claiming safety", () => {
  const result = screen([{ name: "peanuts" }], intent("use_once"));
  assert.equal(result.status, "screened");
  if (result.status !== "screened") return;
  assert.equal(result.screening.status, "match_detected");
  assert.equal(result.screening.establishesAllergenSafety, false);
  assert.equal(result.screening.crossContactEvidence, "unknown");
});

test("no match remains non-authoritative", () => {
  const result = screen([{ name: "rice" }], intent("use_once"));
  assert.equal(result.status, "screened");
  if (result.status !== "screened") return;
  assert.equal(result.screening.status, "no_match_detected");
  assert.equal(result.screening.establishesAllergenSafety, false);
});

test("persist intent and missing evidence cannot authorize transient screening", () => {
  assert.deepEqual(screen([{ name: "peanuts" }], intent("save_to_profile")), { status: "not_screened", reason: "persistent_intent_not_authorized" });
  assert.deepEqual(screen([{ name: "rice" }], { allergies: ["peanut"] }), { status: "not_screened", reason: "invalid_intent" });
  assert.deepEqual(screen([{ name: "rice" }], intent("use_once", [])), { status: "not_screened", reason: "no_confirmed_restrictions" });
  assert.deepEqual(screen([], intent("use_once")), { status: "not_screened", reason: "missing_ingredients" });
});

test("unknown compound ingredients remain unverifiable", () => {
  const result = screen([{ name: "unknown sauce" }], intent("use_once"));
  assert.equal(result.status, "screened");
  if (result.status !== "screened") return;
  assert.equal(result.screening.status, "unverifiable");
});
