import assert from "node:assert/strict";
import test from "node:test";
import {
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


test("confirmed acquisition becomes a parent-unit active lot without inventing evidence", async () => {
  const { buildInventoryLotFromConfirmedAcquisition } = await import("../src/utils/inventoryLots");
  assert.deepEqual(
    buildInventoryLotFromConfirmedAcquisition(
      {
        sourceId: "shopping:item-2",
        source: "shopping_list",
        quantity: 500,
        unit: "g",
        acquiredAt: "2026-10-04",
      },
      "kg",
    ),
    {
      id: "lot:shopping:item-2",
      sourceId: "shopping:item-2",
      source: "shopping_list",
      acquiredAt: "2026-10-04",
      initialQuantity: 0.5,
      remainingQuantity: 0.5,
    },
  );
});

test("confirmed acquisition fails closed for incompatible or invalid evidence", async () => {
  const { buildInventoryLotFromConfirmedAcquisition } = await import("../src/utils/inventoryLots");
  assert.equal(
    buildInventoryLotFromConfirmedAcquisition(
      {
        sourceId: "shopping:item-3",
        source: "shopping_list",
        quantity: 2,
        unit: "pcs",
        acquiredAt: "2026-10-04",
      },
      "kg",
    ),
    null,
  );
  assert.equal(
    buildInventoryLotFromConfirmedAcquisition(
      {
        sourceId: "shopping:item-4",
        source: "shopping_list",
        quantity: 1,
        unit: "kg",
        acquiredAt: "2026-10-04",
        expiryDaysAtAcquisition: 1.5,
      },
      "kg",
    ),
    null,
  );
});

test("adding the same confirmed acquisition source is idempotent", async () => {
  const { addConfirmedAcquisitionLot } = await import("../src/utils/inventoryLots");
  const state = { unallocatedQuantity: 0.25, activeLots: [lot] };
  assert.equal(addConfirmedAcquisitionLot(state, lot), state);
});


test("legacy pantry stock becomes fully unallocated without invented acquisition lots", async () => {
  const { legacyPantryQuantityToLotState } = await import("../src/utils/inventoryLots");
  const item = { quantity: 1.25, unit: "kg" };
  const state = legacyPantryQuantityToLotState(item);
  assert.deepEqual(state, {
    unallocatedQuantity: 1.25,
    activeLots: [],
  });
  assert.deepEqual(item, { quantity: 1.25, unit: "kg" });
});

test("legacy adapter fails closed for invalid stock instead of fabricating state", async () => {
  const { legacyPantryQuantityToLotState } = await import("../src/utils/inventoryLots");
  assert.equal(legacyPantryQuantityToLotState({ quantity: 0, unit: "kg" }), null);
  assert.equal(legacyPantryQuantityToLotState({ quantity: 1, unit: "" }), null);
});
