import assert from "node:assert/strict";
import test from "node:test";
import { loadGuestPantry } from "../src/utils/guestPantry";
import { isLegacyDemoPantryItemId } from "../src/utils/legacyDemoPantryIds";
import type { PantryItem } from "../src/types";

const realItem: PantryItem = {
  id: "guest-real-rice",
  name: "Rice",
  quantity: 500,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "fixture",
};

const legacyDemoRow = (id: "sp-1" | "sp-14"): PantryItem => ({
  id,
  name: "Historical demo fixture",
  quantity: 1,
  unit: "fixture-unit",
  category: "Other",
  addedAt: "fixture",
});

test("missing or malformed guest pantry state stays empty", () => {
  assert.deepEqual(loadGuestPantry(null), []);
  assert.deepEqual(loadGuestPantry("not-json"), []);
  assert.deepEqual(loadGuestPantry(JSON.stringify({ pantry: [] })), []);
});

test("historical demo pantry ids remain blocked without retaining demo food facts", () => {
  assert.equal(isLegacyDemoPantryItemId("sp-1"), true);
  assert.equal(isLegacyDemoPantryItemId("sp-14"), true);
  assert.equal(isLegacyDemoPantryItemId("sp-15"), false);
  assert.equal(isLegacyDemoPantryItemId("guest-real-rice"), false);

  assert.deepEqual(
    loadGuestPantry(JSON.stringify([legacyDemoRow("sp-1"), legacyDemoRow("sp-14")])),
    [],
  );
});

test("legacy demo rows are removed without deleting real guest items", () => {
  const loaded = loadGuestPantry(
    JSON.stringify([legacyDemoRow("sp-1"), realItem, legacyDemoRow("sp-14")]),
  );

  assert.deepEqual(loaded, [realItem]);
});
