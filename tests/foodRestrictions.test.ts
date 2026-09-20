import assert from "node:assert/strict";
import test from "node:test";

import {
  EU_ANNEX_II_ALLERGENS,
  resolveLegacyFoodRestriction,
  resolveLegacyFoodRestrictions,
} from "../src/utils/foodRestrictions";

test("EU Annex II taxonomy contains exactly 14 unique sourced categories", () => {
  assert.equal(EU_ANNEX_II_ALLERGENS.length, 14);

  const ids = EU_ANNEX_II_ALLERGENS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, 14);

  for (const entry of EU_ANNEX_II_ALLERGENS) {
    assert.ok(entry.labels.en.trim());
    assert.ok(entry.labels.es.trim());
    assert.ok(entry.labels.bg.trim());
    assert.equal(entry.source.regulation, "Regulation (EU) No 1169/2011");
    assert.equal(entry.source.annex, "II");
    assert.equal(entry.source.consolidatedDate, "2025-04-01");
    assert.match(entry.source.eurLex, /^https:\/\/eur-lex\.europa\.eu\//);
  }
});

test("legacy exact labels resolve without inventing extra categories", () => {
  assert.deepEqual(resolveLegacyFoodRestriction("Gluten"), {
    status: "resolved",
    rawLabel: "Gluten",
    restrictionIds: ["eu_annex_ii:cereals_containing_gluten"],
    requiresUserConfirmation: false,
  });

  assert.deepEqual(resolveLegacyFoodRestriction("Huevos"), {
    status: "resolved",
    rawLabel: "Huevos",
    restrictionIds: ["eu_annex_ii:eggs"],
    requiresUserConfirmation: false,
  });

  assert.deepEqual(resolveLegacyFoodRestriction("Soja"), {
    status: "resolved",
    rawLabel: "Soja",
    restrictionIds: ["eu_annex_ii:soybeans"],
    requiresUserConfirmation: false,
  });
});

test("legacy lactose stays an intolerance restriction and is not silently rewritten as milk allergy", () => {
  assert.deepEqual(resolveLegacyFoodRestriction("Lactosa"), {
    status: "resolved",
    rawLabel: "Lactosa",
    restrictionIds: ["intolerance:lactose"],
    requiresUserConfirmation: false,
  });
});

test("broad legacy labels remain explicit and require user confirmation", () => {
  assert.deepEqual(resolveLegacyFoodRestriction("Frutos Secos"), {
    status: "broad_legacy",
    rawLabel: "Frutos Secos",
    restrictionIds: ["eu_annex_ii:nuts", "eu_annex_ii:peanuts"],
    requiresUserConfirmation: true,
    reason: "legacy_label_combines_multiple_canonical_categories",
  });

  assert.deepEqual(resolveLegacyFoodRestriction("Marisco"), {
    status: "broad_legacy",
    rawLabel: "Marisco",
    restrictionIds: ["eu_annex_ii:crustaceans", "eu_annex_ii:molluscs"],
    requiresUserConfirmation: true,
    reason: "legacy_label_combines_multiple_canonical_categories",
  });
});

test("unknown legacy restriction remains unresolved rather than guessed", () => {
  assert.deepEqual(resolveLegacyFoodRestriction("algo desconocido"), {
    status: "unrecognized",
    rawLabel: "algo desconocido",
    restrictionIds: [],
    requiresUserConfirmation: true,
    reason: "unrecognized_legacy_label",
  });
});

test("resolver preserves every legacy entry independently for auditability", () => {
  const resolved = resolveLegacyFoodRestrictions([
    "Gluten",
    "Marisco",
    "custom restriction",
  ]);

  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].status, "resolved");
  assert.equal(resolved[1].status, "broad_legacy");
  assert.equal(resolved[2].status, "unrecognized");
});
