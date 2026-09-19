import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_PANTRY } from "../src/data/initialData";
import { loadGuestPantry } from "../src/utils/guestPantry";
import type { PantryItem } from "../src/types";

const realItem: PantryItem = {
  id: "guest-real-rice",
  name: "Rice",
  quantity: 500,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "fixture",
};

test("missing or malformed guest pantry state stays empty", () => {
  assert.deepEqual(loadGuestPantry(null), []);
  assert.deepEqual(loadGuestPantry("not-json"), []);
  assert.deepEqual(loadGuestPantry(JSON.stringify({ pantry: [] })), []);
});

test("known demo pantry rows are never treated as guest inventory", () => {
  assert.deepEqual(loadGuestPantry(JSON.stringify(SAMPLE_PANTRY)), []);
});

test("legacy demo rows are removed without deleting real guest items", () => {
  const loaded = loadGuestPantry(
    JSON.stringify([SAMPLE_PANTRY[0], realItem, SAMPLE_PANTRY[1]]),
  );

  assert.deepEqual(loaded, [realItem]);
});
