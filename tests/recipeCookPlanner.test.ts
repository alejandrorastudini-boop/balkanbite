import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, RecipeIngredient } from "../src/types";
import { planConfirmedRecipeCook } from "../src/utils/recipeCookPlanner";

const stock = (
  id: string,
  quantity: number,
  unit: string,
  expiryDaysLeft: number,
): PantryItem => ({
  id,
  name: "Rice",
  quantity,
  unit,
  expiryDaysLeft,
  category: "Pantry/Grains",
  addedAt: "2026-09-23",
});

const ingredient = (amount: number, unit = "g"): RecipeIngredient => ({
  name: "Rice",
  amount,
  unit,
  inPantry: false,
});

const pantry = (): PantryItem[] => [
  stock("purchase-shopping:old-rice", 100, "g", 1),
  stock("new-rice", 0.2, "kg", 20),
];

const plan = (
  amount = 150,
  unit = "g",
  cookConfirmationId = "cook-a",
  mealId = "recipe:rice-bowl",
) =>
  planConfirmedRecipeCook({
    cookConfirmationId,
    mealId,
    pantry: pantry(),
    ingredients: [ingredient(amount, unit)],
  });

test("multi-lot planner uses expiry order and emits Firestore confirmation", () => {
  const result = plan();
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") return;

  assert.deepEqual(result.allocations.map(item => ({
    id: item.pantryItemId,
    quantity: item.consumedQuantity,
    unit: item.unit,
  })), [
    { id: "purchase-shopping:old-rice", quantity: 100, unit: "g" },
    { id: "new-rice", quantity: 0.05, unit: "kg" },
  ]);

  assert.deepEqual(result.confirmation, {
    cookConfirmationId: "cook-a",
    mealId: "recipe:rice-bowl",
    confirmed: true,
    ingredients: [
      {
        ingredientId: "allocation:1",
        pantryItemId: "purchase-shopping:old-rice",
        quantity: 100,
        unit: "g",
      },
      {
        ingredientId: "allocation:2",
        pantryItemId: "new-rice",
        quantity: 0.05,
        unit: "kg",
      },
    ],
  });

  assert.deepEqual(result.expectedRemaining, {
    "purchase-shopping:old-rice": null,
    "new-rice": 0.15,
  });
});

test("planner is pure and deterministic across repeated invocation", () => {
  const original = pantry();
  const snapshot = JSON.parse(JSON.stringify(original));
  const input = {
    cookConfirmationId: "cook-repeat",
    mealId: "recipe:rice",
    pantry: original,
    ingredients: [ingredient(150)],
  };
  const first = planConfirmedRecipeCook(input);
  const second = planConfirmedRecipeCook(input);
  assert.deepEqual(first, second);
  assert.deepEqual(original, snapshot);
});

test("incompatible, insufficient and invalid quantities fail without allocations", () => {
  for (const [amount, unit, reason] of [
    [1, "L", "incompatible_unit"],
    [500, "g", "insufficient_quantity"],
    [0, "g", "invalid_requirement"],
  ] as const) {
    const result = plan(amount, unit);
    assert.equal(result.outcome, "needs-review");
    if (result.outcome === "needs-review") {
      assert.equal(result.issues[0]?.reason, reason);
    }
  }
});

test("duplicate pantry IDs fail before selecting an arbitrary lot", () => {
  const duplicate = pantry();
  duplicate[1].id = duplicate[0].id;
  const result = planConfirmedRecipeCook({
    cookConfirmationId: "cook-dup",
    mealId: "recipe:dup",
    pantry: duplicate,
    ingredients: [ingredient(100)],
  });
  assert.equal(result.outcome, "needs-review");
  if (result.outcome === "needs-review") {
    assert.equal(result.issues[0]?.reason, "ambiguous-pantry-id");
  }
});

test("journal ID stays strict while logical meal/pantry/allocation IDs may contain colon", () => {
  const good = planConfirmedRecipeCook({
    cookConfirmationId: "cook-safe",
    mealId: "meal:2026-09-29:dinner",
    pantry: [stock("purchase-shopping:s2", 1, "kg", 2)],
    ingredients: [ingredient(0.25, "kg")],
  });
  assert.equal(good.outcome, "ready");
  if (good.outcome === "ready") {
    assert.equal(
      good.confirmation.ingredients[0]?.pantryItemId,
      "purchase-shopping:s2",
    );
    assert.equal(good.confirmation.ingredients[0]?.ingredientId, "allocation:1");
  }

  const badJournal = planConfirmedRecipeCook({
    cookConfirmationId: "cook:unsafe",
    mealId: "recipe:rice",
    pantry: pantry(),
    ingredients: [ingredient(50)],
  });
  assert.equal(badJournal.outcome, "needs-review");
});

test("invalid ingredient identity and empty recipe remain fail-closed", () => {
  const cases = [
    {
      cookConfirmationId: "cook-x",
      mealId: "recipe:x",
      pantry: pantry(),
      ingredients: [],
    },
    {
      cookConfirmationId: "cook-x",
      mealId: "recipe:x",
      pantry: pantry(),
      ingredients: [{ ...ingredient(50), name: " " }],
    },
    {
      cookConfirmationId: "cook-x",
      mealId: "",
      pantry: pantry(),
      ingredients: [ingredient(50)],
    },
  ];
  for (const input of cases) {
    const result = planConfirmedRecipeCook(input);
    assert.equal(result.outcome, "needs-review");
  }
});
