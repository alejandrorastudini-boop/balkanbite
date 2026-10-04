import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConfirmedInventoryLotDeduction,
  buildInventoryLotFromConfirmedAcquisition,
  deriveInventoryLotExpiry,
  inventoryLotStateMatchesQuantity,
  initializeLegacyInventoryLotState,
  collapseLotAllocationAfterManualQuantityEdit,
  collapseLotAllocationAfterAggregateDeduction,
  isValidInventoryLot,
  quantityInParentUnit,
  recommendInventoryLotsForUse,
  type InventoryLot,
} from "../src/utils/inventoryLots";
import type { InventoryLotState } from "../src/types";

const lot: InventoryLot = {
  id: "lot-shopping-item-1",
  sourceId: "shopping:item-1",
  source: "shopping_list",
  acquiredAt: "2026-10-04",
  initialQuantity: 1,
  remainingQuantity: 0.75,
  expiryDaysAtAcquisition: 2,
  initialEstimatedCostEUR: 3.5,
};

test("active inventory lot validates explicit acquisition evidence", () => {
  assert.equal(isValidInventoryLot(lot), true);
  assert.equal(isValidInventoryLot({ ...lot, remainingQuantity: 1.25 }), false);
  assert.equal(isValidInventoryLot({ ...lot, expiryDaysAtAcquisition: 1.5 }), false);
  assert.equal(isValidInventoryLot({ ...lot, acquiredAt: "2026-02-30" }), false);
});

test("lot state quantity equals unallocated stock plus active remaining lots", () => {
  assert.equal(
    inventoryLotStateMatchesQuantity(1, "kg", {
      version: 1 as const,
      unallocatedQuantity: 0.25,
      activeLots: [lot],
    }),
    true,
  );
  assert.equal(
    inventoryLotStateMatchesQuantity(1.1, "kg", {
      version: 1 as const,
      unallocatedQuantity: 0.25,
      activeLots: [lot],
    }),
    false,
  );
});

test("lot state rejects duplicate provenance identities", () => {
  assert.equal(
    inventoryLotStateMatchesQuantity(1.5, "kg", {
      version: 1 as const,
      unallocatedQuantity: 0,
      activeLots: [lot, { ...lot, id: "lot-2" }],
    }),
    false,
  );
});

test("lot expiry derives from acquisition date without persisted days-remaining state", () => {
  assert.deepEqual(
    deriveInventoryLotExpiry(lot, new Date(2026, 9, 5, 12, 0, 0)),
    {
      status: "known",
      expiresOn: "2026-10-06",
      daysRemaining: 1,
      expired: false,
    },
  );
});

test("acquisition quantity converts deterministically into the parent unit", () => {
  assert.equal(quantityInParentUnit(500, "g", "kg"), 0.5);
  assert.equal(quantityInParentUnit(1.5, "L", "ml"), 1500);
  assert.equal(quantityInParentUnit(2, "pcs", "kg"), null);
});


test("confirmed shopping acquisition creates a parent-unit active lot without inventing missing evidence", async () => {
  const { buildInventoryLotFromConfirmedAcquisition } = await import("../src/utils/inventoryLots");
  assert.deepEqual(
    buildInventoryLotFromConfirmedAcquisition({
      sourceId: "shopping:item-42",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      quantity: 500,
      unit: "g",
      parentUnit: "kg",
      expiryDaysAtAcquisition: 30,
    }),
    {
      id: "acquisition:shopping:item-42",
      sourceId: "shopping:item-42",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      initialQuantity: 0.5,
      remainingQuantity: 0.5,
      expiryDaysAtAcquisition: 30,
    },
  );
});

test("confirmed acquisition rejects incompatible units and invalid expiry evidence", async () => {
  const { buildInventoryLotFromConfirmedAcquisition } = await import("../src/utils/inventoryLots");
  assert.equal(
    buildInventoryLotFromConfirmedAcquisition({
      sourceId: "shopping:item-42",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      quantity: 2,
      unit: "pcs",
      parentUnit: "kg",
    }),
    null,
  );
  assert.equal(
    buildInventoryLotFromConfirmedAcquisition({
      sourceId: "shopping:item-42",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      quantity: 1,
      unit: "kg",
      parentUnit: "kg",
      expiryDaysAtAcquisition: 1.5,
    }),
    null,
  );
});

test("appending a confirmed lot preserves aggregate quantity invariant and rejects replay", async () => {
  const {
    appendConfirmedInventoryLot,
    buildInventoryLotFromConfirmedAcquisition,
  } = await import("../src/utils/inventoryLots");
  const acquisition = buildInventoryLotFromConfirmedAcquisition({
    sourceId: "shopping:item-42",
    source: "shopping_list",
    acquiredAt: "2026-10-04",
    quantity: 500,
    unit: "g",
    parentUnit: "kg",
  });
  assert.ok(acquisition);
  const before: InventoryLotState = { version: 1, unallocatedQuantity: 1, activeLots: [] };
  const after = appendConfirmedInventoryLot(1, 1.5, "kg", before, acquisition);
  assert.deepEqual(after, {
    version: 1 as const,
    unallocatedQuantity: 1,
    activeLots: [acquisition],
  });
  assert.equal(
    appendConfirmedInventoryLot(1.5, 2, "kg", after!, acquisition),
    null,
  );
});

test("embedded lot provenance accepts valid long purchase source identity without document-id rewriting", async () => {
  const { buildInventoryLotFromConfirmedAcquisition } = await import("../src/utils/inventoryLots");
  const sourceId = `reconcile:${"a".repeat(250)}:extra:0`;
  const acquisition = buildInventoryLotFromConfirmedAcquisition({
    sourceId,
    source: "confirmed_reconciliation",
    acquiredAt: "2026-10-04",
    quantity: 1,
    unit: "kg",
    parentUnit: "kg",
  });
  assert.equal(acquisition?.sourceId, sourceId);
  assert.equal(acquisition?.id, `acquisition:${sourceId}`);
});



test("confirmed acquisition constructor does not invent monetary lot evidence", () => {
  const created = buildInventoryLotFromConfirmedAcquisition({
    sourceId: "reconcile:r1:extra:0",
    source: "confirmed_reconciliation",
    quantity: 1,
    unit: "kg",
    parentUnit: "kg",
    acquiredAt: "2026-10-04",
  });
  assert.ok(created);
  assert.equal(created.initialEstimatedCostEUR, undefined);
});


test("legacy stock migrates entirely to unallocated quantity without fabricated lots", () => {
  assert.deepEqual(initializeLegacyInventoryLotState(2.5), {
    version: 1 as const,
    unallocatedQuantity: 2.5,
    activeLots: [],
  });
  assert.equal(initializeLegacyInventoryLotState(0), null);
  assert.equal(initializeLegacyInventoryLotState(Number.NaN), null);
});

test("generic manual absolute edit collapses prior lot allocation to declared unallocated stock", () => {
  assert.deepEqual(collapseLotAllocationAfterManualQuantityEdit(0.8), {
    version: 1 as const,
    unallocatedQuantity: 0.8,
    activeLots: [],
  });
});


test("generic aggregate deduction discards unsupported lot precision", () => {
  const before = {
    version: 1 as const,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    collapseLotAllocationAfterAggregateDeduction(1, 0.6, "kg", before),
    {
      outcome: "remaining-unallocated",
      state: {
        version: 1,
        unallocatedQuantity: 0.6,
        activeLots: [],
      },
    },
  );
});

test("aggregate deduction reports depletion without fabricating zero-quantity lots", () => {
  const before = {
    version: 1 as const,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    collapseLotAllocationAfterAggregateDeduction(1, 0, "kg", before),
    { outcome: "depleted", state: null },
  );
});

test("aggregate deduction rejects increases and inconsistent pre-deduction lot state", () => {
  const before = {
    version: 1 as const,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    collapseLotAllocationAfterAggregateDeduction(1, 1.1, "kg", before),
    { outcome: "invalid", state: null },
  );
  assert.deepEqual(
    collapseLotAllocationAfterAggregateDeduction(2, 1, "kg", before),
    { outcome: "invalid", state: null },
  );
});


test("FEFO recommendation ranks usable known expiry first without mutating lot state", () => {
  const later: InventoryLot = {
    ...lot,
    id: "lot-later",
    sourceId: "shopping:later",
    acquiredAt: "2026-10-04",
    initialQuantity: 0.5,
    remainingQuantity: 0.5,
    expiryDaysAtAcquisition: 5,
  };
  const sooner: InventoryLot = {
    ...lot,
    id: "lot-sooner",
    sourceId: "shopping:sooner",
    acquiredAt: "2026-10-04",
    initialQuantity: 0.25,
    remainingQuantity: 0.25,
    expiryDaysAtAcquisition: 2,
  };
  const unknown: InventoryLot = {
    ...lot,
    id: "lot-unknown",
    sourceId: "shopping:unknown",
    acquiredAt: "2026-10-03",
    initialQuantity: 0.25,
    remainingQuantity: 0.25,
    expiryDaysAtAcquisition: undefined,
  };
  const state = {
    version: 1 as const,
    unallocatedQuantity: 0,
    activeLots: [later, unknown, sooner],
  };
  const snapshot = structuredClone(state);
  const recommendation = recommendInventoryLotsForUse(
    state,
    new Date(2026, 9, 5, 12, 0, 0),
  );
  assert.deepEqual(
    recommendation?.usableLots.map((item) => item.id),
    ["lot-sooner", "lot-later", "lot-unknown"],
  );
  assert.deepEqual(recommendation?.expiredLotIds, []);
  assert.deepEqual(state, snapshot);
});

test("FEFO recommendation excludes explicitly expired lots from food-use advice", () => {
  const expired: InventoryLot = {
    ...lot,
    id: "lot-expired",
    sourceId: "shopping:expired",
    acquiredAt: "2026-10-01",
    initialQuantity: 0.25,
    remainingQuantity: 0.25,
    expiryDaysAtAcquisition: 1,
  };
  const recommendation = recommendInventoryLotsForUse(
    { version: 1, unallocatedQuantity: 0, activeLots: [expired] },
    new Date(2026, 9, 5, 12, 0, 0),
  );
  assert.deepEqual(recommendation?.usableLots, []);
  assert.deepEqual(recommendation?.expiredLotIds, ["lot-expired"]);
});


test("confirmed acquisition preserves explicit initial cost evidence without deriving remaining cost", () => {
  const created = buildInventoryLotFromConfirmedAcquisition({
    sourceId: "shopping:item-cost",
    source: "shopping_list",
    quantity: 1,
    unit: "kg",
    parentUnit: "kg",
    acquiredAt: "2026-10-04",
    initialEstimatedCostEUR: 4,
  });
  assert.ok(created);
  assert.equal(created.initialEstimatedCostEUR, 4);
  assert.equal("remainingCostEUR" in created, false);
});

test("confirmed acquisition rejects invalid monetary evidence", () => {
  assert.equal(
    buildInventoryLotFromConfirmedAcquisition({
      sourceId: "shopping:item-cost",
      source: "shopping_list",
      quantity: 1,
      unit: "kg",
      parentUnit: "kg",
      acquiredAt: "2026-10-04",
      initialEstimatedCostEUR: -1,
    }),
    null,
  );
});


test("optional persisted lot state is usable only when it reconciles to the parent pantry item", async () => {
  const { getVerifiedInventoryLotState } = await import("../src/utils/inventoryLots");
  const pantry = {
    id: "milk",
    name: "Milk",
    quantity: 1,
    unit: "L",
    category: "Dairy" as const,
    addedAt: "2026-10-04",
    lotState: {
      version: 1 as const,
      unallocatedQuantity: 0.25,
      activeLots: [
        {
          id: "shopping:milk-1",
          sourceId: "shopping:milk-1",
          source: "shopping_list" as const,
          acquiredAt: "2026-10-04",
          initialQuantity: 0.75,
          remainingQuantity: 0.75,
        },
      ],
    },
  };
  assert.deepEqual(getVerifiedInventoryLotState(pantry), pantry.lotState);
  assert.equal(
    getVerifiedInventoryLotState({ ...pantry, quantity: 2 }),
    null,
  );
});

test("legacy pantry without persisted lot state remains valid but has no invented lot precision", async () => {
  const { getVerifiedInventoryLotState } = await import("../src/utils/inventoryLots");
  assert.equal(
    getVerifiedInventoryLotState({
      id: "rice",
      name: "Rice",
      quantity: 1,
      unit: "kg",
      category: "Pantry/Grains",
      addedAt: "2026-10-04",
    }),
    null,
  );
});


test("lot-state validation fails closed on missing or unsupported schema version", () => {
  assert.equal(
    inventoryLotStateMatchesQuantity(1, "kg", {
      unallocatedQuantity: 1,
      activeLots: [],
    } as any),
    false,
  );
  assert.equal(
    inventoryLotStateMatchesQuantity(1, "kg", {
      version: 2,
      unallocatedQuantity: 1,
      activeLots: [],
    } as any),
    false,
  );
});


test("confirmed physical lot deduction changes only the explicitly selected acquisition lot and preserves unrelated provenance", () => {
  const second: InventoryLot = {
    ...lot,
    id: "lot-second",
    sourceId: "shopping:second",
    initialQuantity: 0.5,
    remainingQuantity: 0.5,
    expiryDaysAtAcquisition: 5,
  };
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0.25,
    activeLots: [lot, second],
  };
  const result = applyConfirmedInventoryLotDeduction(
    1.5,
    "kg",
    state,
    [{ lotId: lot.id, quantity: 0.25 }],
    "food-use",
    "2026-10-05",
  );
  assert.deepEqual(result, {
    outcome: "applied",
    state: {
      version: 1,
      unallocatedQuantity: 0.25,
      activeLots: [
        { ...lot, remainingQuantity: 0.5 },
        second,
      ],
    },
  });
});

test("confirmed lot deduction never substitutes FEFO or unallocated stock for missing physical confirmation", () => {
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      1,
      "kg",
      state,
      [{ lotId: "not-confirmed", quantity: 0.25 }],
      "food-use",
    ),
    { outcome: "invalid", state: null },
  );
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      1,
      "kg",
      state,
      [{ lotId: lot.id, quantity: 0.8 }],
      "food-use",
    ),
    { outcome: "invalid", state: null },
  );
});

test("food-use blocks explicitly expired confirmed lots while disposal removal may deduct them", () => {
  const expired: InventoryLot = {
    ...lot,
    id: "lot-expired-confirmed",
    sourceId: "shopping:expired-confirmed",
    acquiredAt: "2026-10-01",
    initialQuantity: 0.5,
    remainingQuantity: 0.5,
    expiryDaysAtAcquisition: 1,
  };
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [expired],
  };
  const reviewedOn = "2026-10-05";
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      0.5,
      "kg",
      state,
      [{ lotId: expired.id, quantity: 0.5 }],
      "food-use",
      reviewedOn,
    ),
    {
      outcome: "expiry-review-required",
      state: null,
      lotIds: [expired.id],
    },
  );
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      0.5,
      "kg",
      state,
      [{ lotId: expired.id, quantity: 0.5 }],
      "removal",
    ),
    { outcome: "applied", state: null },
  );
});

test("confirmed lot deduction preserves unallocated uncertainty instead of fabricating full depletion", () => {
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  const result = applyConfirmedInventoryLotDeduction(
    1,
    "kg",
    state,
    [{ lotId: lot.id, quantity: 0.75 }],
    "removal",
  );
  assert.deepEqual(result, {
    outcome: "applied",
    state: {
      version: 1,
      unallocatedQuantity: 0.25,
      activeLots: [],
    },
  });
});


test("food-use lot attribution requires a stable reviewed calendar date", () => {
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      1,
      "kg",
      state,
      [{ lotId: lot.id, quantity: 0.25 }],
      "food-use",
    ),
    { outcome: "invalid", state: null },
  );
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      1,
      "kg",
      state,
      [{ lotId: lot.id, quantity: 0.25 }],
      "food-use",
      "2026-02-30",
    ),
    { outcome: "invalid", state: null },
  );
});

test("stable reviewed date makes expiry decision independent from retry wall clock", () => {
  const expiring: InventoryLot = {
    ...lot,
    id: "lot-stable-review",
    sourceId: "shopping:stable-review",
    acquiredAt: "2026-10-04",
    initialQuantity: 0.5,
    remainingQuantity: 0.5,
    expiryDaysAtAcquisition: 2,
  };
  const state: InventoryLotState = {
    version: 1,
    unallocatedQuantity: 0,
    activeLots: [expiring],
  };
  const reviewedOn = "2026-10-05";
  assert.deepEqual(
    applyConfirmedInventoryLotDeduction(
      0.5,
      "kg",
      state,
      [{ lotId: expiring.id, quantity: 0.25 }],
      "food-use",
      reviewedOn,
    ),
    {
      outcome: "applied",
      state: {
        version: 1,
        unallocatedQuantity: 0,
        activeLots: [{ ...expiring, remainingQuantity: 0.25 }],
      },
    },
  );
});
