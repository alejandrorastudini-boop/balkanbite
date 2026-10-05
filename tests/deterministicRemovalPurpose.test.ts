import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { parseDeterministicRemovalIntent } from "../src/utils/deterministicRemovalIntent";

const pantry: PantryItem[] = [{
  id: "rice",
  name: "Rice",
  nameEs: "Arroz",
  nameBg: "Ориз",
  quantity: 1,
  unit: "kg",
  category: "Pantry/Grains",
  addedAt: "2026-10-01",
}];

test("classifies explicit food use without guessing discard semantics", () => {
  const result = parseDeterministicRemovalIntent("He usado 200 g de arroz", pantry);
  assert.equal(result?.purpose, "food-use");
  assert.equal(result?.items[0]?.quantity, 200);
  assert.equal(result?.items[0]?.unit, "g");
});

test("classifies explicit discard separately from food use", () => {
  const result = parseDeterministicRemovalIntent("He tirado 200 g de arroz", pantry);
  assert.equal(result?.purpose, "discard");
});

test("generic deduction wording stays unresolved", () => {
  assert.equal(parseDeterministicRemovalIntent("Descuenta 200 g de arroz", pantry), null);
  assert.equal(parseDeterministicRemovalIntent("Deduct 200 g rice", pantry), null);
});

test("mixed consume and discard wording stays unresolved", () => {
  assert.equal(
    parseDeterministicRemovalIntent("He usado y he tirado 200 g de arroz", pantry),
    null,
  );
});
