import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProgressionEvents,
  buildPurchaseProgressEvents,
  buildRecipeCookProgressEvent,
  eligibleProgressEventCount,
  isValidProgressionEvent,
  isValidProgressionTimestamp,
  type ProgressionEventV1,
} from "../src/utils/progressionLedger";

const NOW = "2026-09-20T15:30:00.000Z";

const cookResult = {
  pantry: [],
  deductions: [
    {
      ingredientName: "hidden from ledger",
      pantryItemId: "pantry-1",
      consumedQuantity: 100,
      unit: "g",
    },
  ],
  issues: [],
};

test("progression timestamp requires a valid explicit timezone", () => {
  assert.equal(isValidProgressionTimestamp(NOW), true);
  assert.equal(isValidProgressionTimestamp("2026-09-20T15:30:00"), false);
  assert.equal(isValidProgressionTimestamp("not-a-date"), false);
});

test("successful deterministic pantry consumption can create a cook event", () => {
  const event = buildRecipeCookProgressEvent({
    actionId: "cook-action-001",
    occurredAt: NOW,
    result: cookResult,
  });

  assert.deepEqual(event, {
    version: 1,
    eventId: "cook:cook-action-001",
    type: "recipe_cook_inventory_applied",
    occurredAt: NOW,
    evidence: "deterministic_state_transition",
    evidenceCount: 1,
  });
  assert.equal(JSON.stringify(event).includes("hidden from ledger"), false);
  assert.equal(JSON.stringify(event).includes("pantry-1"), false);
});

test("cook event is rejected when no pantry deduction was applied", () => {
  assert.equal(
    buildRecipeCookProgressEvent({
      actionId: "cook-action-002",
      occurredAt: NOW,
      result: { pantry: [], deductions: [], issues: [] },
    }),
    null,
  );
});

test("cook event is rejected when deterministic consumption has issues", () => {
  assert.equal(
    buildRecipeCookProgressEvent({
      actionId: "cook-action-003",
      occurredAt: NOW,
      result: {
        pantry: [],
        deductions: [],
        issues: [
          {
            ingredientName: "unknown",
            requiredAmount: 1,
            requiredUnit: "kg",
            reason: "no_matching_item",
          },
        ],
      },
    }),
    null,
  );
});

test("purchase builder emits one event per unique newly applied source", () => {
  const events = buildPurchaseProgressEvents({
    occurredAt: NOW,
    newlyAppliedSourceIds: [
      "shopping:item-1",
      "shopping:item-1",
      "reconcile:trip-1:extra:0",
      "contains spaces",
    ],
  });

  assert.deepEqual(events, [
    {
      version: 1,
      eventId: "purchase:shopping:item-1",
      type: "confirmed_purchase_applied",
      occurredAt: NOW,
      evidence: "deterministic_state_transition",
      evidenceCount: 1,
    },
    {
      version: 1,
      eventId: "purchase:reconcile:trip-1:extra:0",
      type: "confirmed_purchase_applied",
      occurredAt: NOW,
      evidence: "deterministic_state_transition",
      evidenceCount: 1,
    },
  ]);
});

test("ledger append is idempotent by eventId", () => {
  const event = buildRecipeCookProgressEvent({
    actionId: "cook-action-004",
    occurredAt: NOW,
    result: cookResult,
  });
  assert.ok(event);

  const first = appendProgressionEvents([], [event]);
  assert.deepEqual(first.addedEventIds, ["cook:cook-action-004"]);
  assert.equal(eligibleProgressEventCount(first.ledger), 1);

  const repeated = appendProgressionEvents(first.ledger, [event]);
  assert.deepEqual(repeated.addedEventIds, []);
  assert.deepEqual(repeated.rejectedEventIds, []);
  assert.equal(eligibleProgressEventCount(repeated.ledger), 1);
});

test("invalid event cannot create progress", () => {
  const result = appendProgressionEvents([], [
    {
      version: 1,
      eventId: "bad-event",
      type: "meal_log_recorded",
      occurredAt: NOW,
      evidence: "user_declared",
      evidenceCount: 1,
    },
  ]);

  assert.deepEqual(result.ledger, []);
  assert.deepEqual(result.addedEventIds, []);
  assert.deepEqual(result.rejectedEventIds, ["bad-event"]);
});

test("ledger canonicalization strips arbitrary extra metadata", () => {
  const candidate = {
    version: 1,
    eventId: "cook:opaque-action",
    type: "recipe_cook_inventory_applied",
    occurredAt: NOW,
    evidence: "deterministic_state_transition",
    evidenceCount: 2,
    foodName: "must not persist",
    weightKg: 70,
    credits: 999,
    cashValue: 25,
  };

  assert.equal(isValidProgressionEvent(candidate), true);

  const result = appendProgressionEvents([], [candidate]);
  assert.deepEqual(result.ledger, [
    {
      version: 1,
      eventId: "cook:opaque-action",
      type: "recipe_cook_inventory_applied",
      occurredAt: NOW,
      evidence: "deterministic_state_transition",
      evidenceCount: 2,
    },
  ]);
  assert.equal("foodName" in result.ledger[0], false);
  assert.equal("weightKg" in result.ledger[0], false);
  assert.equal("credits" in result.ledger[0], false);
  assert.equal("cashValue" in result.ledger[0], false);
});

test("eligible event count ignores malformed ledger rows", () => {
  const valid: ProgressionEventV1 = {
    version: 1,
    eventId: "purchase:shopping:item-2",
    type: "confirmed_purchase_applied",
    occurredAt: NOW,
    evidence: "deterministic_state_transition",
    evidenceCount: 1,
  };

  assert.equal(
    eligibleProgressEventCount([
      valid,
      {
        ...valid,
        eventId: "bad id with spaces",
      },
    ]),
    1,
  );
});

test("source references are bounded so derived event IDs remain valid", () => {
  const tooLong = "a".repeat(151);
  assert.deepEqual(
    buildPurchaseProgressEvents({
      occurredAt: NOW,
      newlyAppliedSourceIds: [tooLong],
    }),
    [],
  );

  assert.equal(
    buildRecipeCookProgressEvent({
      actionId: tooLong,
      occurredAt: NOW,
      result: cookResult,
    }),
    null,
  );
});
