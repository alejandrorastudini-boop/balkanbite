import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem, RecipeIngredient } from "../src/types";
import {
  planRecipeCookAgainstAuthoritativePantry,
  type RecipeCookPlanInput,
} from "../src/utils/confirmedRecipeCookLots";
import { cookRequestSignature } from "../src/utils/confirmedCookFirestore";

const stock = (
  id: string,
  name: string,
  quantity: number,
  unit: string,
  expiryDaysLeft: number,
): PantryItem => ({
  id,
  name,
  quantity,
  unit,
  expiryDaysLeft,
  category: "Pantry/Grains",
  addedAt: "2026-09-29",
});

const ingredient = (
  name: string,
  amount: number,
  unit: string,
): RecipeIngredient => ({
  name,
  amount,
  unit,
  inPantry: true,
});

const basePantry = (): PantryItem[] => [
  stock("rice-old", "Rice", 100, "g", 1),
  stock("purchase-shopping:s2", "Rice", 0.2, "kg", 20),
  stock("salt", "Salt", 500, "g", 300),
];

const baseAuthority = () => [
  {
    pantryItemId: "rice-old",
    quantity: 100,
    unit: "g",
    cookRevision: 2,
  },
  {
    pantryItemId: "purchase-shopping:s2",
    quantity: 0.2,
    unit: "kg",
    cookRevision: 0,
  },
  {
    pantryItemId: "salt",
    quantity: 500,
    unit: "g",
    cookRevision: 7,
  },
];

const input = (
  overrides: Partial<RecipeCookPlanInput> = {},
): RecipeCookPlanInput => ({
  userId: "alice",
  cookConfirmationId: "cook-rice-1",
  mealId: "recipe-rice-1",
  confirmed: true,
  pantry: basePantry(),
  authoritativeStock: baseAuthority(),
  ingredients: [ingredient("Rice", 150, "g")],
  ...overrides,
});

test("plans deterministic expiry-first multi-lot recipe deductions against exact authority", () => {
  const result = planRecipeCookAgainstAuthoritativePantry(input());
  assert.equal(result.outcome, "planned");
  if (result.outcome !== "planned") return;

  assert.deepEqual(result.allocations, [
    {
      ingredientName: "Rice",
      pantryItemId: "rice-old",
      consumedQuantity: 100,
      unit: "g",
    },
    {
      ingredientName: "Rice",
      pantryItemId: "purchase-shopping:s2",
      consumedQuantity: 0.05,
      unit: "kg",
    },
  ]);

  assert.deepEqual(result.request.expectedStock, [
    {
      pantryItemId: "rice-old",
      quantity: 100,
      unit: "g",
      cookRevision: 2,
    },
    {
      pantryItemId: "purchase-shopping:s2",
      quantity: 0.2,
      unit: "kg",
      cookRevision: 0,
    },
  ]);

  assert.deepEqual(result.expectedRemaining, {
    "rice-old": null,
    "purchase-shopping:s2": 0.15,
  });
  assert.deepEqual(
    result.expectedPantry.map(item => ({
      id: item.id,
      quantity: item.quantity,
      unit: item.unit,
    })),
    [
      { id: "purchase-shopping:s2", quantity: 0.15, unit: "kg" },
      { id: "salt", quantity: 500, unit: "g" },
    ],
  );
  assert.equal(result.signature, cookRequestSignature(result.request));
});

test("purchase-created colon IDs are preserved into atomic cook request", () => {
  const result = planRecipeCookAgainstAuthoritativePantry(input({
    ingredients: [ingredient("Rice", 0.15, "kg")],
  }));
  assert.equal(result.outcome, "planned");
  if (result.outcome !== "planned") return;
  assert.ok(
    result.request.confirmation.ingredients.some(
      item => item.pantryItemId === "purchase-shopping:s2",
    ),
  );
  assert.ok(
    result.request.expectedStock.some(
      item => item.pantryItemId === "purchase-shopping:s2",
    ),
  );
});

test("full visible pantry must match authoritative IDs quantity and unit before planning", () => {
  const cases: RecipeCookPlanInput[] = [
    input({
      authoritativeStock: baseAuthority().slice(0, 2),
    }),
    input({
      authoritativeStock: baseAuthority().map(item =>
        item.pantryItemId === "rice-old"
          ? { ...item, quantity: 120 }
          : item,
      ),
    }),
    input({
      authoritativeStock: baseAuthority().map(item =>
        item.pantryItemId === "rice-old"
          ? { ...item, unit: "kg" }
          : item,
      ),
    }),
  ];

  const reasons = cases.map(value => {
    const result = planRecipeCookAgainstAuthoritativePantry(value);
    assert.equal(result.outcome, "needs-review");
    return result.outcome === "needs-review"
      ? result.issues[0]?.reason
      : null;
  });

  assert.deepEqual(reasons, [
    "unverified-authority",
    "stale-visible-pantry",
    "stale-visible-pantry",
  ]);
});

test("duplicate pantry or authority IDs fail closed rather than choosing a lot", () => {
  const duplicatePantry = basePantry();
  duplicatePantry[1] = {
    ...duplicatePantry[1],
    id: "rice-old",
  };
  const pantryResult = planRecipeCookAgainstAuthoritativePantry(input({
    pantry: duplicatePantry,
  }));
  assert.equal(pantryResult.outcome, "needs-review");
  if (pantryResult.outcome === "needs-review") {
    assert.equal(pantryResult.issues[0]?.reason, "ambiguous-pantry-id");
  }

  const duplicateAuthority = [
    ...baseAuthority(),
    { ...baseAuthority()[0] },
  ];
  const authorityResult = planRecipeCookAgainstAuthoritativePantry(input({
    authoritativeStock: duplicateAuthority,
  }));
  assert.equal(authorityResult.outcome, "needs-review");
  if (authorityResult.outcome === "needs-review") {
    assert.equal(authorityResult.issues[0]?.reason, "unverified-authority");
  }
});

test("recipe quantity/unit problems preserve pantry and return deterministic review issues", () => {
  for (const [recipeIngredient, reason] of [
    [ingredient("Rice", 500, "g"), "insufficient_quantity"],
    [ingredient("Rice", 1, "L"), "incompatible_unit"],
    [ingredient("Unknown food", 1, "pcs"), "no_matching_item"],
    [ingredient("Rice", 0, "g"), "invalid_requirement"],
  ] as const) {
    const result = planRecipeCookAgainstAuthoritativePantry(input({
      ingredients: [recipeIngredient],
    }));
    assert.equal(result.outcome, "needs-review");
    if (result.outcome === "needs-review") {
      assert.equal(result.issues[0]?.reason, reason);
    }
  }
});

test("unconfirmed or invalid operation identity never produces an atomic request", () => {
  for (const value of [
    input({ confirmed: false }),
    input({ cookConfirmationId: "" }),
    input({ mealId: "meal:unsafe-for-current-journal-rule" }),
    input({ ingredients: [] }),
  ]) {
    const result = planRecipeCookAgainstAuthoritativePantry(value);
    assert.equal(result.outcome, "needs-review");
    if (result.outcome === "needs-review") {
      assert.equal(result.issues[0]?.reason, "invalid-confirmation");
    }
  }
});

test("authority array order does not change planned replay signature", () => {
  const first = planRecipeCookAgainstAuthoritativePantry(input());
  const second = planRecipeCookAgainstAuthoritativePantry(input({
    authoritativeStock: [...baseAuthority()].reverse(),
  }));
  assert.equal(first.outcome, "planned");
  assert.equal(second.outcome, "planned");
  if (first.outcome === "planned" && second.outcome === "planned") {
    assert.equal(first.signature, second.signature);
    assert.deepEqual(first.request.confirmation, second.request.confirmation);
  }
});

test("unaffected pantry lots are authority-checked but excluded from cook expectedStock", () => {
  const result = planRecipeCookAgainstAuthoritativePantry(input());
  assert.equal(result.outcome, "planned");
  if (result.outcome !== "planned") return;
  assert.equal(
    result.request.expectedStock.some(item => item.pantryItemId === "salt"),
    false,
  );
  assert.ok(result.expectedPantry.some(item => item.id === "salt"));
});
