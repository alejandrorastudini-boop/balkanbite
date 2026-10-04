import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("signed-in quantity mutations invalidate stale pantry value", () => {
  const cook = read("src/utils/confirmedCookFirestore.ts");
  const voice = read("src/utils/verifiedVoiceConsumptionFirestore.ts");
  const edit = read("src/utils/inventoryAdjustmentFirestore.ts");

  assert.match(cook, /quantity,\s*estimatedCostEUR: null,/);
  assert.match(voice, /quantity: remaining,\s*estimatedCostEUR: null,/);
  assert.match(edit, /quantity: adjustment\.quantity,\s*estimatedCostEUR: null,/);
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
