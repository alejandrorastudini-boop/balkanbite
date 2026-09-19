import assert from "node:assert/strict";
import test from "node:test";
import {
  BULGARIAN_FOOD_ALIAS_FIXTURE,
  BULGARIAN_HOUSEHOLD_UNIT_FIXTURE,
  areReviewedBulgarianFoodAliases,
} from "../src/utils/bulgarianFoodAliases";
import { isPantryNameMatch } from "../src/utils/menuAutoPlanner";
import { normalizeUnit } from "../src/utils/quantityUnits";
import type { PantryItem } from "../src/types";

const pantryItem = (name: string): PantryItem => ({
  id: "fixture-item",
  name,
  quantity: 1,
  unit: "pcs",
  category: "Other",
  addedAt: "fixture",
});

test("matches only reviewed Bulgarian food-name aliases", () => {
  assert.equal(areReviewedBulgarianFoodAliases("йогурт", "кисело мляко"), true);
  assert.equal(areReviewedBulgarianFoodAliases("млеко", "мляко"), true);
  assert.equal(areReviewedBulgarianFoodAliases("айрян", "кисело мляко"), false);
});

test("reviewed aliases participate in pantry name matching", () => {
  assert.equal(isPantryNameMatch("йогурт", pantryItem("кисело мляко")), true);
  assert.equal(isPantryNameMatch("млеко", pantryItem("мляко")), true);
});

test("household-unit fixture resolves through the deterministic unit engine", () => {
  for (const fixture of BULGARIAN_HOUSEHOLD_UNIT_FIXTURE) {
    for (const alias of fixture.aliases) {
      const normalized = normalizeUnit(alias);
      assert.equal(normalized?.known, true);
      assert.equal(normalized?.canonical, fixture.canonicalUnit);
    }
  }
});

test("fixture contains provenance only and no inferred food facts", () => {
  for (const entry of BULGARIAN_FOOD_ALIAS_FIXTURE) {
    assert.ok(entry.source.startsWith("https://ibl.bas.bg/"));
    assert.deepEqual(Object.keys(entry).sort(), ["aliases", "canonical", "source"]);
  }

  for (const entry of BULGARIAN_HOUSEHOLD_UNIT_FIXTURE) {
    assert.ok(entry.source.startsWith("https://ibl.bas.bg/"));
    assert.deepEqual(Object.keys(entry).sort(), ["aliases", "canonicalUnit", "source"]);
  }
});
