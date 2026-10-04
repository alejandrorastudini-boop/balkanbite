import assert from "node:assert/strict";
import test from "node:test";
import { isAuthoritativePantryNameMatch, isPantryNameMatch } from "../src/utils/menuAutoPlanner";
import type { PantryItem } from "../src/types";

const item = (
  name: string,
  localized: Partial<Pick<PantryItem, "nameBg" | "nameEs">> = {},
): PantryItem => ({
  id: "match-fixture",
  name,
  quantity: 1,
  unit: "pcs",
  category: "Other",
  addedAt: "fixture",
  ...localized,
});

test("does not treat character substrings as food identity", () => {
  assert.equal(isPantryNameMatch("egg", item("eggplant")), false);
  assert.equal(isPantryNameMatch("oil", item("boiled eggs")), false);
  assert.equal(isPantryNameMatch("sal", item("ensalada preparada")), false);
});

test("matches complete requirement words inside a more descriptive pantry name", () => {
  assert.equal(isPantryNameMatch("egg", item("fresh eggs")), true);
  assert.equal(isPantryNameMatch("olive oil", item("extra virgin olive oil")), true);
  assert.equal(isPantryNameMatch("tomates", item("tomate")), true);
});

test("does not collapse distinct equally-specific foods that share one word", () => {
  assert.equal(isPantryNameMatch("red pepper", item("black pepper")), false);
  assert.equal(isPantryNameMatch("olive oil", item("sunflower oil")), false);
  assert.equal(isPantryNameMatch("chicken breast", item("chicken thighs")), false);
});

test("still checks explicit localized names and reviewed Bulgarian aliases", () => {
  assert.equal(
    isPantryNameMatch("tomate", item("tomato", { nameEs: "tomate" })),
    true,
  );
  assert.equal(
    isPantryNameMatch("йогурт", item("yogurt", { nameBg: "кисело мляко" })),
    true,
  );
});


test("authoritative identity rejects descriptive token containment", () => {
  assert.equal(isAuthoritativePantryNameMatch("egg", item("fresh eggs")), false);
  assert.equal(isAuthoritativePantryNameMatch("olive oil", item("extra virgin olive oil")), false);
  assert.equal(isAuthoritativePantryNameMatch("pepper", item("red pepper")), false);
});

test("authoritative identity keeps exact localized names and reviewed aliases", () => {
  assert.equal(
    isAuthoritativePantryNameMatch("tomate", item("tomato", { nameEs: "tomate" })),
    true,
  );
  assert.equal(
    isAuthoritativePantryNameMatch("йогурт", item("yogurt", { nameBg: "кисело мляко" })),
    true,
  );
});
