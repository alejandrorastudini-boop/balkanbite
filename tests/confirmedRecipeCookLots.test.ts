import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, RecipeIngredient } from "../src/types";
import {
  confirmRecipeCookWithLots,
  type ConfirmedRecipeCookState,
} from "../src/utils/confirmedRecipeCookLots";

const stock = (id: string, quantity: number, unit: string, expiryDaysLeft: number): PantryItem => ({
  id,
  name: "Rice",
  quantity,
  unit,
  expiryDaysLeft,
  category: "Pantry/Grains",
  addedAt: "2026-09-23",
});
const ingredient = (amount: number, unit = "g"): RecipeIngredient => ({
  name: "Rice", amount, unit, inPantry: false,
});
const initial = (): ConfirmedRecipeCookState => ({
  pantry: [stock("old", 100, "g", 1), stock("new", 0.2, "kg", 20)],
  consumptionRecords: [],
});
const cook = (amount = 150, unit = "g", id = "cook-a", mealId = "meal-a") => ({
  cookConfirmationId: id, mealId, confirmed: true,
  ingredients: [ingredient(amount, unit)],
});

test("multi-lot recipe confirmation uses expiry order, journal and stock metadata", () => {
  const state = initial();
  const result = confirmRecipeCookWithLots(state, cook());
  assert.equal(result.outcome, "recorded");
  if (result.outcome !== "recorded") return;
  assert.deepEqual(result.allocations.map(d => ({
    id: d.pantryItemId, quantity: d.consumedQuantity, unit: d.unit,
  })), [
    { id: "old", quantity: 100, unit: "g" },
    { id: "new", quantity: 0.05, unit: "kg" },
  ]);
  assert.deepEqual(result.state.pantry, [stock("new", 0.15, "kg", 20)]);
  assert.deepEqual(result.record.deductions.map(d => ({
    id: d.pantryItemId, quantity: d.quantity, unit: d.unit,
  })), [
    { id: "old", quantity: 100, unit: "g" },
    { id: "new", quantity: 0.05, unit: "kg" },
  ]);
  assert.equal(result.state.consumptionRecords.length, 1);
  assert.deepEqual(state, initial(), "pure preview must not alter original state");
});

test("stable cook ID replays safely after serialized state is restored", () => {
  const first = confirmRecipeCookWithLots(initial(), cook());
  assert.equal(first.outcome, "recorded");
  if (first.outcome !== "recorded") return;
  const restored = JSON.parse(JSON.stringify(first.state)) as ConfirmedRecipeCookState;
  const replay = confirmRecipeCookWithLots(restored, cook());
  assert.equal(replay.outcome, "already-recorded");
  assert.deepEqual(replay.state, first.state);
  assert.equal(replay.outcome === "already-recorded" && replay.record.cookConfirmationId, "cook-a");
});

test("same confirmation ID for another meal fails closed", () => {
  const first = confirmRecipeCookWithLots(initial(), cook());
  assert.equal(first.outcome, "recorded");
  if (first.outcome !== "recorded") return;
  const retry = confirmRecipeCookWithLots(first.state, cook(150, "g", "cook-a", "meal-b"));
  assert.equal(retry.outcome, "needs-review");
  if (retry.outcome === "needs-review") {
    assert.equal(retry.issues[0]?.reason, "confirmation-id-conflict");
    assert.deepEqual(retry.state, first.state);
  }
});

test("incompatible and insufficient units never partially deduct or journal", () => {
  for (const [amount, unit, reason] of [
    [1, "l", "incompatible_unit"],
    [500, "g", "insufficient_quantity"],
    [0, "g", "invalid_requirement"],
  ] as const) {
    const state = initial();
    const result = confirmRecipeCookWithLots(state, cook(amount, unit));
    assert.equal(result.outcome, "needs-review");
    assert.deepEqual(result.state, state);
    assert.equal(result.outcome === "needs-review" && result.issues[0]?.reason, reason);
  }
});

test("duplicate pantry stock IDs cannot resolve to an arbitrary lot", () => {
  const state = initial();
  state.pantry[1].id = "old";
  const result = confirmRecipeCookWithLots(state, cook());
  assert.equal(result.outcome, "needs-review");
  assert.deepEqual(result.state, state);
  assert.equal(result.outcome === "needs-review" && result.issues[0]?.reason, "ambiguous-pantry-id");
});

test("unconfirmed, invalid identity and empty ingredient list remain unchanged", () => {
  for (const input of [
    { ...cook(), confirmed: false },
    { ...cook(), cookConfirmationId: " " },
    { ...cook(), mealId: "" },
    { ...cook(), ingredients: [] },
  ]) {
    const state = initial();
    const result = confirmRecipeCookWithLots(state, input);
    assert.equal(result.outcome, "needs-review");
    assert.deepEqual(result.state, state);
  }
});

test("reused confirmation ID with altered ingredients fails closed", () => {
  const first = confirmRecipeCookWithLots(initial(), cook());
  assert.equal(first.outcome, "recorded");
  if (first.outcome !== "recorded") return;
  for (const different of [
    cook(100, "g"),
    cook(0.15, "kg"),
    { ...cook(), ingredients: [{ ...ingredient(150), name: "Potatoes" }] },
  ]) {
    const retry = confirmRecipeCookWithLots(first.state, different);
    assert.equal(retry.outcome, "needs-review");
    if (retry.outcome === "needs-review") {
      assert.equal(retry.issues[0]?.reason, "confirmation-id-conflict");
      assert.deepEqual(retry.state, first.state);
    }
  }
});

test("legacy or duplicate journal IDs never silently authorize replay", () => {
  const first = confirmRecipeCookWithLots(initial(), cook());
  assert.equal(first.outcome, "recorded");
  if (first.outcome !== "recorded") return;
  const legacy = JSON.parse(JSON.stringify(first.state)) as ConfirmedRecipeCookState;
  delete legacy.consumptionRecords[0].requestSignature;
  const missingSignature = confirmRecipeCookWithLots(legacy, cook());
  assert.equal(missingSignature.outcome, "needs-review");
  assert.deepEqual(missingSignature.state, legacy);
  const duplicate = JSON.parse(JSON.stringify(first.state)) as ConfirmedRecipeCookState;
  duplicate.consumptionRecords.push({ ...duplicate.consumptionRecords[0] });
  const ambiguous = confirmRecipeCookWithLots(duplicate, cook());
  assert.equal(ambiguous.outcome, "needs-review");
  assert.equal(ambiguous.outcome === "needs-review" && ambiguous.issues[0]?.reason,
    "ambiguous-confirmation-id");
  assert.deepEqual(ambiguous.state, duplicate);
});
