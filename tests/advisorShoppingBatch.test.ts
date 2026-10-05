import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingItem } from "../src/types";
import { buildAdvisorBatchFingerprint } from "../src/utils/advisorShoppingBatch";

type AdvisorItem = Omit<ShoppingItem, "id" | "checked">;

const milk = (reason: string): AdvisorItem => ({
  name: " Milk ",
  quantity: 1,
  unit: " L ",
  category: "Dairy",
  amountOrigin: "deterministic_shortfall",
  purchaseAmountConfirmed: false,
  reason,
});

test("advisor batch fingerprint ignores localized explanatory copy", () => {
  assert.equal(
    buildAdvisorBatchFingerprint([milk("For breakfast (Today)")]),
    buildAdvisorBatchFingerprint([milk("Para desayuno (Hoy)")]),
  );
});

test("advisor batch fingerprint is independent of candidate order", () => {
  const bread: AdvisorItem = {
    ...milk("For lunch"),
    name: "Bread",
    quantity: 2,
    unit: "pcs",
    category: "Pantry/Grains",
  };
  assert.equal(
    buildAdvisorBatchFingerprint([milk("Today"), bread]),
    buildAdvisorBatchFingerprint([bread, milk("Днес")]),
  );
});

test("advisor batch fingerprint changes when authoritative shortage amount changes", () => {
  assert.notEqual(
    buildAdvisorBatchFingerprint([milk("Today")]),
    buildAdvisorBatchFingerprint([{ ...milk("Today"), quantity: 0.5 }]),
  );
});
