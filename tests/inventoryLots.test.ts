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
  initialCostEUR: 3.5,
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
  assert.equal(created.initialCostEUR, undefined);
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
