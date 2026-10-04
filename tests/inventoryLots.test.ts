import assert from "node:assert/strict";
import test from "node:test";
import {
  addConfirmedAcquisitionLot,
  deriveInventoryLotExpiry,
  inventoryLotStateMatchesQuantity,
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


test("confirmed acquisition creates one active lot in the parent unit", () => {
  const result = addConfirmedAcquisitionLot(
    { unallocatedQuantity: 0.25, activeLots: [] },
    "kg",
    {
      sourceId: "shopping:item-2",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      quantity: 500,
      unit: "g",
      expiryDaysAtAcquisition: 3,
      initialCostEUR: 2,
    },
  );
  assert.equal(result.outcome, "added");
  if (result.outcome !== "added") return;
  assert.equal(result.lot.initialQuantity, 0.5);
  assert.equal(result.lot.remainingQuantity, 0.5);
  assert.equal(result.state.unallocatedQuantity, 0.25);
  assert.equal(result.state.activeLots.length, 1);
});

test("confirmed acquisition replay is idempotent by source provenance", () => {
  const state = { unallocatedQuantity: 0, activeLots: [lot] };
  const result = addConfirmedAcquisitionLot(state, "kg", {
    sourceId: lot.sourceId,
    source: lot.source,
    acquiredAt: lot.acquiredAt,
    quantity: 1,
    unit: "kg",
  });
  assert.equal(result.outcome, "already-recorded");
  assert.equal(result.state, state);
});

test("confirmed acquisition rejects incompatible unit dimensions without mutation", () => {
  const state = { unallocatedQuantity: 0, activeLots: [] };
  const result = addConfirmedAcquisitionLot(state, "kg", {
    sourceId: "shopping:item-3",
    source: "shopping_list",
    acquiredAt: "2026-10-04",
    quantity: 2,
    unit: "pcs",
  });
  assert.equal(result.outcome, "invalid");
  assert.equal(result.state, state);
});
