import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECIPES } from "../src/data/initialData";
import {
  asChatActionType,
  parseChatMessageCache,
  sanitizeChatActionMetadata,
  sanitizeStoredChatMessage,
} from "../src/utils/chatMessageValidation";

const baseMessage = {
  id: "msg-1",
  sender: "assistant",
  text: "Try bean soup.",
  timestamp: "13:05",
};

test("all six active voice action types are recognized", () => {
  for (const actionType of [
    "MEAL_LOG",
    "RECIPE_RECOMMENDATION",
    "ADD_ITEMS",
    "REMOVE_ITEMS",
    "ADD_SHOPPING",
    "ANSWER",
  ] as const) {
    assert.equal(asChatActionType(actionType), actionType);
  }
});

test("stale legacy or unknown action metadata is removed without losing valid text", () => {
  for (const actionType of [
    "pantry_update",
    "shopping_list_add",
    "recipe_suggest",
    "meal_log",
    "SOMETHING_NEW",
  ]) {
    const result = sanitizeStoredChatMessage({
      ...baseMessage,
      actionType,
      itemsAffected: [{ name: "Beans", quantity: 1, unit: "kg" }],
    });

    assert.ok(result);
    assert.equal(result?.text, baseMessage.text);
    assert.equal(result?.actionType, undefined);
    assert.equal(result?.itemsAffected, undefined);
  }
});

test("item metadata survives only for recognized item actions and complete positive rows", () => {
  const validItems = [
    { name: " Beans ", quantity: 2, unit: " kg " },
    { name: "Onion", quantity: 1, unit: "pcs" },
  ];

  for (const actionType of ["ADD_ITEMS", "REMOVE_ITEMS", "ADD_SHOPPING"] as const) {
    assert.deepEqual(
      sanitizeChatActionMetadata(actionType, validItems),
      {
        actionType,
        itemsAffected: [
          { name: "Beans", quantity: 2, unit: "kg" },
          { name: "Onion", quantity: 1, unit: "pcs" },
        ],
      },
    );
  }

  assert.deepEqual(
    sanitizeChatActionMetadata("ANSWER", validItems),
    { actionType: "ANSWER" },
  );

  assert.deepEqual(
    sanitizeChatActionMetadata("ADD_ITEMS", [
      { name: "Beans", quantity: 0, unit: "kg" },
    ]),
    { actionType: "ADD_ITEMS" },
  );
});

test("invalid required chat identity quarantines the whole message", () => {
  for (const candidate of [
    { ...baseMessage, id: "" },
    { ...baseMessage, sender: "system" },
    { ...baseMessage, text: "   " },
    { ...baseMessage, timestamp: "" },
    null,
    "message",
  ]) {
    assert.equal(sanitizeStoredChatMessage(candidate), null);
  }
});

test("valid suggested recipe is preserved while malformed recipe metadata is omitted", () => {
  const sample = SAMPLE_RECIPES[0];
  assert.ok(sample);

  const valid = sanitizeStoredChatMessage({
    ...baseMessage,
    actionType: "RECIPE_RECOMMENDATION",
    suggestedRecipe: sample,
  });
  assert.equal(valid?.suggestedRecipe?.id, sample.id);

  const invalid = sanitizeStoredChatMessage({
    ...baseMessage,
    actionType: "RECIPE_RECOMMENDATION",
    suggestedRecipe: { id: "broken" },
  });
  assert.equal(invalid?.suggestedRecipe, undefined);
});

test("nested logged meal uses the existing safe stored-meal sanitizer", () => {
  const result = sanitizeStoredChatMessage({
    ...baseMessage,
    actionType: "MEAL_LOG",
    loggedMeal: {
      id: "meal-1",
      date: "2026-09-20",
      timestamp: "2026-09-20T19:00:00.000Z",
      mealType: "dinner",
      manualName: "Soup",
      nutritionDataStatus: "unknown",
      calories: 500,
      proteinG: 20,
      carbsG: 60,
      fatG: 15,
    },
  });

  assert.deepEqual(result?.loggedMeal, {
    id: "meal-1",
    date: "2026-09-20",
    mealType: "dinner",
    manualName: "Soup",
    nutritionDataStatus: "unknown",
    timestamp: "2026-09-20T19:00:00.000Z",
  });
});

test("chat cache parser sanitizes mixed rows and never trusts top-level JSON shape", () => {
  const parsed = parseChatMessageCache(
    JSON.stringify([
      {
        ...baseMessage,
        sender: "user",
        text: "What can I cook?",
      },
      {
        ...baseMessage,
        id: "msg-2",
        actionType: "ANSWER",
      },
      {
        ...baseMessage,
        id: "",
      },
    ]),
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.sender, "user");
  assert.equal(parsed[1]?.actionType, "ANSWER");

  assert.deepEqual(parseChatMessageCache(null), []);
  assert.deepEqual(parseChatMessageCache("{bad json"), []);
  assert.deepEqual(parseChatMessageCache(JSON.stringify(baseMessage)), []);
});
