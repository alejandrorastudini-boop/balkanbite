import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("signed-in quantity mutations invalidate stale pantry value", () => {
  const cook = read("src/utils/confirmedCookFirestore.ts");
  const voice = read("src/utils/verifiedVoiceConsumptionFirestore.ts");
  const edit = read("src/utils/inventoryAdjustmentFirestore.ts");

  assert.match(cook, /quantity,[\s\S]*estimatedCostEUR: null,/);
  assert.match(voice, /quantity: remaining,[\s\S]*estimatedCostEUR: null,/);
  assert.match(edit, /quantity: adjustment\.quantity,[\s\S]*estimatedCostEUR: null,/);
});

test("guest manual quantity edit invalidates stale value and preserves expiry uncertainty", () => {
  const app = read("src/App.tsx");
  const start = app.indexOf("const handleUpdatePantryQuantity");
  const end = app.indexOf("const handleDeletePantryItem", start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.match(handler, /estimatedCostEUR: null/);
  assert.match(handler, /shouldMarkExpiryPartialAfterQuantityIncrease/);
});


test("aggregate quantity mutations collapse lot precision instead of inferring FEFO usage", () => {
  const cook = read("src/utils/confirmedCookFirestore.ts");
  const voice = read("src/utils/verifiedVoiceConsumptionFirestore.ts");
  const edit = read("src/utils/inventoryAdjustmentFirestore.ts");
  const guest = read("src/utils/pantryConsumption.ts");
  const clear = read("src/utils/inventoryClearFirestore.ts");
  const app = read("src/App.tsx");

  assert.match(cook, /lotState: \{ version: 1, unallocatedQuantity: quantity, activeLots: \[\] \}/);
  assert.match(cook, /lotState: \{ version: 1, unallocatedQuantity: 0, activeLots: \[\] \}/);
  assert.match(voice, /lotState: \{ version: 1, unallocatedQuantity: remaining, activeLots: \[\] \}/);
  assert.match(voice, /lotState: \{ version: 1, unallocatedQuantity: 0, activeLots: \[\] \}/);
  assert.match(edit, /lotState: \{ version: 1, unallocatedQuantity: adjustment\.quantity, activeLots: \[\] \}/);
  assert.match(edit, /lotState: \{ version: 1, unallocatedQuantity: 0, activeLots: \[\] \}/);
  assert.match(guest, /lotState: \{[\s\S]*unallocatedQuantity: roundQuantity\(remainingInItemUnit\),[\s\S]*activeLots: \[\]/);
  assert.match(clear, /quantity: 0,[\s\S]*lotState: \{ version: 1, unallocatedQuantity: 0, activeLots: \[\] \}/);
  assert.match(app, /quantity: newQty,[\s\S]*lotState: \{ version: 1, unallocatedQuantity: newQty, activeLots: \[\] \}/);
});


test("authoritative aggregate writers fail closed on corrupt persisted lot state", () => {
  for (const path of [
    "src/utils/inventoryAdjustmentFirestore.ts",
    "src/utils/confirmedCookFirestore.ts",
    "src/utils/verifiedVoiceConsumptionFirestore.ts",
    "src/utils/inventoryClearFirestore.ts",
  ]) {
    const source = read(path);
    assert.match(source, /lotState !== undefined/);
    assert.match(source, /inventoryLotStateMatchesQuantity\(/);
  }
});
