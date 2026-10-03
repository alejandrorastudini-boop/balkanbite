import assert from "node:assert/strict";
import test from "node:test";
import {
  arePurchaseSourcesVisible,
  buildPendingPurchaseCommitEvidence,
  isPurchaseCommitVisible,
} from "../src/utils/purchaseCommitEvidence";

const pantry = [
  {
    id: "tomato",
    name: "Tomate",
    quantity: 1.5,
    unit: "kg",
    category: "Produce" as const,
    addedAt: "2026-09-01",
    purchaseHistory: [
      {
        sourceId: "legacy:tomato",
        source: "pantry_legacy" as const,
        name: "Tomate",
        quantity: 1,
        unit: "kg",
        acquiredAt: "2026-09-01",
      },
      {
        sourceId: "shopping:s1",
        source: "shopping_list" as const,
        name: "Tomate",
        quantity: 0.5,
        unit: "kg",
        acquiredAt: "2026-09-29",
      },
    ],
  },
  {
    id: "purchase-shopping:s2",
    name: "Leche",
    quantity: 1,
    unit: "L",
    category: "Dairy" as const,
    addedAt: "2026-09-29",
    purchaseHistory: [{
      sourceId: "shopping:s2",
      source: "shopping_list" as const,
      name: "Leche",
      quantity: 1,
      unit: "L",
      acquiredAt: "2026-09-29",
    }],
  },
];

const merge = {
  pantry,
  acceptedSourceIds: ["shopping:s1", "shopping:s2"],
  newlyAppliedSourceIds: ["shopping:s1", "shopping:s2"],
  rejected: [],
};

test("builds exact quantity/unit/source evidence grouped by pantry lot", () => {
  const pending = buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    merge,
  );
  assert.deepEqual(pending?.expected, [
    {
      pantryItemId: "purchase-shopping:s2",
      quantity: 1,
      unit: "L",
      sourceIds: ["shopping:s2"],
    },
    {
      pantryItemId: "tomato",
      quantity: 1.5,
      unit: "kg",
      sourceIds: ["shopping:s1"],
    },
  ]);
  assert.equal(isPurchaseCommitVisible(pending!, "alice", pantry), true);
});

test("same quantity without purchase source evidence is never considered committed", () => {
  const pending = buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    merge,
  )!;
  const missingHistory = pantry.map(item =>
    item.id === "tomato"
      ? {
          ...item,
          purchaseHistory: item.purchaseHistory?.filter(
            record => record.sourceId !== "shopping:s1",
          ),
        }
      : item,
  );
  assert.equal(isPurchaseCommitVisible(pending, "alice", missingHistory), false);
});

test("wrong quantity, unit or user cannot finalize purchase", () => {
  const pending = buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    merge,
  )!;
  assert.equal(isPurchaseCommitVisible(pending, "bob", pantry), false);
  assert.equal(isPurchaseCommitVisible(
    pending,
    "alice",
    pantry.map(item => item.id === "tomato" ? { ...item, quantity: 1.4 } : item),
  ), false);
  assert.equal(isPurchaseCommitVisible(
    pending,
    "alice",
    pantry.map(item => item.id === "tomato" ? { ...item, unit: "g" } : item),
  ), false);
});

test("idempotent already-applied purchase has no stock wait but keeps accepted rows", () => {
  const pending = buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    {
      pantry,
      acceptedSourceIds: ["shopping:s1", "shopping:s2"],
      newlyAppliedSourceIds: [],
      rejected: [],
    },
  );
  assert.ok(pending);
  assert.deepEqual(pending?.expected, []);
  assert.equal(isPurchaseCommitVisible(pending!, "alice", pantry), true);
});

test("ambiguous or missing newly-applied source history fails closed", () => {
  const missing = buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    {
      pantry,
      acceptedSourceIds: ["shopping:unknown"],
      newlyAppliedSourceIds: ["shopping:unknown"],
      rejected: [],
    },
  );
  assert.equal(missing, null);

  const duplicateSourcePantry = [
    pantry[0],
    {
      ...pantry[1],
      purchaseHistory: [
        ...(pantry[1].purchaseHistory || []),
        {
          sourceId: "shopping:s1",
          source: "shopping_list" as const,
          name: "Tomate",
          quantity: 0.5,
          unit: "kg",
          acquiredAt: "2026-09-29",
        },
      ],
    },
  ];
  assert.equal(buildPendingPurchaseCommitEvidence(
    "alice",
    "purchase-abc-2",
    "2026-09-29T08:00:00.000Z",
    {
      pantry: duplicateSourcePantry,
      acceptedSourceIds: ["shopping:s1"],
      newlyAppliedSourceIds: ["shopping:s1"],
      rejected: [],
    },
  ), null);
});

test("historical purchase source proof survives later stock consumption", () => {
  const laterPantry = pantry.map(item =>
    item.id === "tomato" ? { ...item, quantity: 0.25 } : item,
  );
  assert.equal(
    arePurchaseSourcesVisible(
      ["shopping:s1", "shopping:s2"],
      laterPantry,
    ),
    true,
  );
});

test("purchase source proof fails on missing or ambiguous history", () => {
  assert.equal(
    arePurchaseSourcesVisible(
      ["shopping:missing"],
      pantry,
    ),
    false,
  );

  const ambiguous = [
    ...pantry,
    {
      ...pantry[1],
      id: "duplicate-history",
      purchaseHistory: [
        ...(pantry[1].purchaseHistory || []),
        {
          sourceId: "shopping:s1",
          source: "shopping_list" as const,
          name: "Tomate",
          quantity: 0.5,
          unit: "kg",
          acquiredAt: "2026-09-29",
        },
      ],
    },
  ];
  assert.equal(
    arePurchaseSourcesVisible(["shopping:s1"], ambiguous),
    false,
  );
});
