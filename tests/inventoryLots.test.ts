import assert from "node:assert/strict";
import test from "node:test";
import {
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
      unallocatedQuantity: 0.25,
      activeLots: [lot],
    }),
    true,
  );
  assert.equal(
    inventoryLotStateMatchesQuantity(1.1, "kg", {
      unallocatedQuantity: 0.25,
      activeLots: [lot],
    }),
    false,
  );
});

test("lot state rejects duplicate provenance identities", () => {
  assert.equal(
    inventoryLotStateMatchesQuantity(1.5, "kg", {
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
  const before = { unallocatedQuantity: 1, activeLots: [] };
  const after = appendConfirmedInventoryLot(1, 1.5, "kg", before, acquisition);
  assert.deepEqual(after, {
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
    unallocatedQuantity: 2.5,
    activeLots: [],
  });
  assert.equal(initializeLegacyInventoryLotState(0), null);
  assert.equal(initializeLegacyInventoryLotState(Number.NaN), null);
});

test("generic manual absolute edit collapses prior lot allocation to declared unallocated stock", () => {
  assert.deepEqual(collapseLotAllocationAfterManualQuantityEdit(0.8), {
    unallocatedQuantity: 0.8,
    activeLots: [],
  });
});


test("generic aggregate deduction discards unsupported lot precision", () => {
  const before = {
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    collapseLotAllocationAfterAggregateDeduction(1, 0.6, "kg", before),
    {
      outcome: "remaining-unallocated",
      state: {
        unallocatedQuantity: 0.6,
        activeLots: [],
      },
    },
  );
});

test("aggregate deduction reports depletion without fabricating zero-quantity lots", () => {
  const before = {
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
    { unallocatedQuantity: 0, activeLots: [expired] },
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


test("lot-state persistence boundary accepts only invariant-preserving explicit payloads", async () => {
  const { parseInventoryLotStateForParent } = await import("../src/utils/inventoryLots");
  const payload = {
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  assert.deepEqual(
    parseInventoryLotStateForParent(payload, 1, "kg"),
    payload,
  );
  assert.equal(
    parseInventoryLotStateForParent(payload, 1.1, "kg"),
    null,
  );
  assert.equal(
    parseInventoryLotStateForParent(
      { unallocatedQuantity: 0.25, activeLots: [{ ...lot, sourceId: "" }] },
      1,
      "kg",
    ),
    null,
  );
  assert.equal(
    parseInventoryLotStateForParent(
      { unallocatedQuantity: 1, activeLots: [] },
      1,
      "mystery-unit",
    ),
    null,
  );
});

test("lot-state persistence boundary returns a detached state instead of aliasing input", async () => {
  const { parseInventoryLotStateForParent } = await import("../src/utils/inventoryLots");
  const payload = {
    unallocatedQuantity: 0.25,
    activeLots: [lot],
  };
  const parsed = parseInventoryLotStateForParent(payload, 1, "kg");
  assert.ok(parsed);
  assert.notEqual(parsed, payload);
  assert.notEqual(parsed.activeLots, payload.activeLots);
  assert.notEqual(parsed.activeLots[0], payload.activeLots[0]);
});
