import assert from "node:assert/strict";
import test from "node:test";
import { buildRecipeCookPlan } from "../src/utils/recipeCookPlan";

const pantry = [
  {
    id: "rice-old",
    name: "Rice",
    quantity: 100,
    unit: "g",
    category: "Pantry/Grains" as const,
    addedAt: "2026-09-01",
    expiryDaysLeft: 1,
    cookRevision: 2,
  },
  {
    id: "rice-new",
    name: "Rice",
    quantity: 0.2,
    unit: "kg",
    category: "Pantry/Grains" as const,
    addedAt: "2026-09-10",
    expiryDaysLeft: 5,
    cookRevision: 4,
  },
  {
    id: "oil",
    name: "Oil",
    quantity: 100,
    unit: "ml",
    category: "Pantry/Grains" as const,
    addedAt: "2026-09-05",
    cookRevision: 1,
  },
];

test("recipe cook plan resolves expiry-first multi-lot allocations and exact stock baseline", () => {
  const result = buildRecipeCookPlan({
    cookConfirmationId: "cook-abc",
    mealId: "recipe-rice",
    confirmed: true,
    pantry,
    ingredients: [
      { name: "Rice", amount: 150, unit: "g", inPantry: true },
    ],
  });
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") return;

  assert.deepEqual(result.plan.deductions, [
    {
      ingredientName: "Rice",
      pantryItemId: "rice-old",
      consumedQuantity: 100,
      unit: "g",
    },
    {
      ingredientName: "Rice",
      pantryItemId: "rice-new",
      consumedQuantity: 0.05,
      unit: "kg",
    },
  ]);

  assert.deepEqual(result.plan.expectedStock, [
    {
      pantryItemId: "rice-new",
      quantity: 0.2,
      unit: "kg",
      cookRevision: 4,
    },
    {
      pantryItemId: "rice-old",
      quantity: 100,
      unit: "g",
      cookRevision: 2,
    },
  ]);

  assert.deepEqual(result.plan.expectedRemaining, [
    { pantryItemId: "rice-new", quantity: 0.15 },
    { pantryItemId: "rice-old", quantity: null },
  ]);

  assert.equal(result.plan.confirmation.ingredients.length, 2);
  assert.ok(result.plan.confirmation.ingredients.every(
    item => /^allocation-\d+-[0-9a-f]{8}$/.test(item.ingredientId),
  ));
});

test("recipe request identity participates in allocation IDs", () => {
  const first = buildRecipeCookPlan({
    cookConfirmationId: "cook-one",
    mealId: "recipe-mixed",
    confirmed: true,
    pantry,
    ingredients: [
      { name: "Rice", amount: 50, unit: "g", inPantry: true },
      { name: "Oil", amount: 10, unit: "ml", inPantry: true },
    ],
  });
  const reordered = buildRecipeCookPlan({
    cookConfirmationId: "cook-two",
    mealId: "recipe-mixed",
    confirmed: true,
    pantry,
    ingredients: [
      { name: "Oil", amount: 10, unit: "ml", inPantry: true },
      { name: "Rice", amount: 50, unit: "g", inPantry: true },
    ],
  });
  assert.equal(first.outcome, "ready");
  assert.equal(reordered.outcome, "ready");
  if (first.outcome !== "ready" || reordered.outcome !== "ready") return;

  assert.notEqual(
    first.plan.confirmation.ingredients[0].ingredientId,
    reordered.plan.confirmation.ingredients[0].ingredientId,
  );
});

test("unsafe recipe ingredient rolls back the whole cook plan", () => {
  const result = buildRecipeCookPlan({
    cookConfirmationId: "cook-short",
    mealId: "recipe-short",
    confirmed: true,
    pantry,
    ingredients: [
      { name: "Rice", amount: 50, unit: "g", inPantry: true },
      { name: "Oil", amount: 500, unit: "ml", inPantry: true },
    ],
  });
  assert.equal(result.outcome, "needs-review");
  if (result.outcome !== "needs-review") return;
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].ingredientName, "Oil");
  assert.equal(result.issues[0].reason, "insufficient_quantity");
});

test("duplicate or malformed pantry IDs cannot produce a confirmation plan", () => {
  const duplicate = buildRecipeCookPlan({
    cookConfirmationId: "cook-dup",
    mealId: "recipe-dup",
    confirmed: true,
    pantry: [
      pantry[0],
      { ...pantry[1], id: pantry[0].id },
    ],
    ingredients: [
      { name: "Rice", amount: 10, unit: "g", inPantry: true },
    ],
  });
  assert.deepEqual(duplicate, {
    outcome: "needs-review",
    issues: [{ ingredientName: "pantry", reason: "invalid-stock" }],
  });

  const badRevision = buildRecipeCookPlan({
    cookConfirmationId: "cook-rev",
    mealId: "recipe-rev",
    confirmed: true,
    pantry: [{ ...pantry[0], cookRevision: -1 }],
    ingredients: [
      { name: "Rice", amount: 10, unit: "g", inPantry: true },
    ],
  });
  assert.equal(badRevision.outcome, "needs-review");
});

test("unversioned canonical pantry can be captured only as explicit revision zero", () => {
  const result = buildRecipeCookPlan({
    cookConfirmationId: "cook-legacy",
    mealId: "recipe-legacy",
    confirmed: true,
    pantry: [{
      id: "rice-legacy",
      name: "Rice",
      quantity: 100,
      unit: "g",
      category: "Pantry/Grains",
      addedAt: "2026-09-01",
    }],
    ingredients: [
      { name: "Rice", amount: 25, unit: "g", inPantry: true },
    ],
  });
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") return;
  assert.deepEqual(result.plan.expectedStock, [{
    pantryItemId: "rice-legacy",
    quantity: 100,
    unit: "g",
    cookRevision: 0,
  }]);
});
