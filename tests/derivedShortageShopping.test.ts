import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "../src/types";
import {
  buildDerivedShortageId,
  isManagedDerivedShortageRow,
  reconcileDerivedShortageShoppingItems,
} from "../src/utils/derivedShortageShopping";

const candidate = (quantity: number, unit = "g") => ({
  name: "Rice",
  quantity,
  unit,
  category: "Pantry/Grains",
  amountOrigin: "deterministic_shortfall" as const,
  purchaseAmountConfirmed: false,
  reason: "Needed for plan",
});

test("stable identity is based on normalized food identity and unit dimension", () => {
  assert.equal(buildDerivedShortageId(" Rice ", "g"), buildDerivedShortageId("rice", "kg"));
  assert.notEqual(buildDerivedShortageId("Rice", "g"), buildDerivedShortageId("Rice", "pcs"));
  assert.equal(buildDerivedShortageId("", "g"), null);
  assert.equal(buildDerivedShortageId("Rice", "unknown-unit"), null);
});

test("creates one managed unchecked row without inventing purchase confirmation", () => {
  const result = reconcileDerivedShortageShoppingItems([], [candidate(500)]);
  assert.equal(result.changed, true);
  assert.equal(result.next.length, 1);
  assert.equal(result.next[0].checked, false);
  assert.equal(result.next[0].purchaseAmountConfirmed, false);
  assert.equal(isManagedDerivedShortageRow(result.next[0]), true);
});

test("repeated reconciliation is idempotent", () => {
  const first = reconcileDerivedShortageShoppingItems([], [candidate(500)]);
  const second = reconcileDerivedShortageShoppingItems(first.next, [candidate(500)]);
  assert.equal(second.changed, false);
  assert.deepEqual(second.next, first.next);
});

test("updates the derived quantity instead of duplicating the row", () => {
  const first = reconcileDerivedShortageShoppingItems([], [candidate(500)]);
  const second = reconcileDerivedShortageShoppingItems(first.next, [candidate(750)]);
  assert.equal(second.next.length, 1);
  assert.equal(second.next[0].quantity, 750);
});

test("resolved shortage removes only managed derived rows and preserves manual rows", () => {
  const manual: ShoppingItem = {
    id: "manual-rice",
    name: "Rice",
    quantity: 2,
    unit: "kg",
    category: "Pantry/Grains",
    checked: false,
    amountOrigin: "user_entered",
    purchaseAmountConfirmed: false,
  };
  const first = reconcileDerivedShortageShoppingItems([manual], [candidate(500)]);
  const resolved = reconcileDerivedShortageShoppingItems(first.next, []);
  assert.deepEqual(resolved.next, [manual]);
});

test("legacy deterministic rows are preserved because BalkanBite does not own their lifecycle", () => {
  const legacy: ShoppingItem = {
    id: "s-advisor-old",
    name: "Rice",
    quantity: 500,
    unit: "g",
    category: "Pantry/Grains",
    checked: false,
    amountOrigin: "deterministic_shortfall",
    purchaseAmountConfirmed: false,
  };
  const result = reconcileDerivedShortageShoppingItems([legacy], []);
  assert.deepEqual(result.next, [legacy]);
});

test("invalid candidates remain unresolved instead of becoming shopping quantities", () => {
  const bad = [
    { ...candidate(500), purchaseAmountConfirmed: true },
    { ...candidate(500), amountOrigin: "ai_estimated" as const },
    { ...candidate(500), quantity: Number.NaN },
    candidate(500, "unknown-unit"),
  ];
  const result = reconcileDerivedShortageShoppingItems([], bad);
  assert.deepEqual(result.next, []);
});

test("equivalent candidate units aggregate deterministically", () => {
  const result = reconcileDerivedShortageShoppingItems(
    [],
    [candidate(500, "g"), candidate(0.5, "kg")],
  );
  assert.equal(result.next.length, 1);
  assert.equal(result.next[0].quantity, 1000);
  assert.equal(result.next[0].unit, "g");
});
