import assert from "node:assert/strict";
import test from "node:test";
import { deductRecipeIngredientsFromPantry } from "../src/utils/pantryConsumption";
import {
  mergePurchasesIntoPantry,
  type PantryPurchase,
} from "../src/utils/purchasePantryMerge";
import {
  appendProgressionEvents,
  buildPurchaseProgressEvents,
  buildRecipeCookProgressEvent,
  eligibleProgressEventCount,
} from "../src/utils/progressionLedger";
import type { PantryItem, RecipeIngredient } from "../src/types";

const occurredAt = "2026-09-20T16:10:00.000Z";
const acquiredAt = "2026-09-20";

test("idempotent purchase replay does not generate additional progression", () => {
  const purchase: PantryPurchase = {
    sourceId: "shopping:progress-item-1",
    source: "shopping_list",
    name: "Tomato",
    quantity: 1,
    unit: "kg",
    category: "Produce",
  };

  const first = mergePurchasesIntoPantry([], [purchase], acquiredAt);
  assert.deepEqual(first.newlyAppliedSourceIds, ["shopping:progress-item-1"]);

  const firstEvents = buildPurchaseProgressEvents({
    occurredAt,
    newlyAppliedSourceIds: first.newlyAppliedSourceIds,
  });
  const firstLedger = appendProgressionEvents([], firstEvents).ledger;
  assert.equal(eligibleProgressEventCount(firstLedger), 1);

  const replay = mergePurchasesIntoPantry(first.pantry, [purchase], acquiredAt);
  assert.deepEqual(replay.acceptedSourceIds, ["shopping:progress-item-1"]);
  assert.deepEqual(replay.newlyAppliedSourceIds, []);

  const replayEvents = buildPurchaseProgressEvents({
    occurredAt: "2026-09-20T16:11:00.000Z",
    newlyAppliedSourceIds: replay.newlyAppliedSourceIds,
  });
  const replayLedger = appendProgressionEvents(firstLedger, replayEvents).ledger;
  assert.equal(eligibleProgressEventCount(replayLedger), 1);
});

test("each successful explicit cook action can generate one event", () => {
  const pantry: PantryItem[] = [
    {
      id: "pantry-rice",
      name: "Rice",
      quantity: 500,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: acquiredAt,
    },
  ];
  const ingredients: RecipeIngredient[] = [
    { name: "Rice", amount: 100, unit: "g", inPantry: true },
  ];

  const firstResult = deductRecipeIngredientsFromPantry(pantry, ingredients);
  assert.equal(firstResult.issues.length, 0);
  assert.equal(firstResult.deductions.length, 1);

  const firstEvent = buildRecipeCookProgressEvent({
    actionId: "cook-action-a",
    occurredAt,
    result: firstResult,
  });
  assert.ok(firstEvent);

  const secondResult = deductRecipeIngredientsFromPantry(
    firstResult.pantry,
    ingredients,
  );
  const secondEvent = buildRecipeCookProgressEvent({
    actionId: "cook-action-b",
    occurredAt: "2026-09-20T16:12:00.000Z",
    result: secondResult,
  });
  assert.ok(secondEvent);

  const ledger = appendProgressionEvents([], [firstEvent, secondEvent]).ledger;
  assert.equal(eligibleProgressEventCount(ledger), 2);
  assert.notEqual(firstEvent.eventId, secondEvent.eventId);
});

test("failed cook action produces no progression event", () => {
  const pantry: PantryItem[] = [
    {
      id: "pantry-rice",
      name: "Rice",
      quantity: 50,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: acquiredAt,
    },
  ];
  const result = deductRecipeIngredientsFromPantry(pantry, [
    { name: "Rice", amount: 100, unit: "g", inPantry: true },
  ]);

  assert.equal(result.issues.length, 1);
  assert.equal(result.deductions.length, 0);
  assert.equal(
    buildRecipeCookProgressEvent({
      actionId: "cook-action-failed",
      occurredAt,
      result,
    }),
    null,
  );
});

test("reusing the same cook action id remains idempotent at ledger boundary", () => {
  const result = deductRecipeIngredientsFromPantry(
    [
      {
        id: "pantry-rice",
        name: "Rice",
        quantity: 500,
        unit: "g",
        category: "Pantry/Grains",
        addedAt: acquiredAt,
      },
    ],
    [{ name: "Rice", amount: 100, unit: "g", inPantry: true }],
  );

  const event = buildRecipeCookProgressEvent({
    actionId: "cook-action-same",
    occurredAt,
    result,
  });
  assert.ok(event);

  const ledger = appendProgressionEvents([], [event, event]).ledger;
  assert.equal(eligibleProgressEventCount(ledger), 1);
});
