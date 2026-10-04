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

test("guest manual quantity edit also invalidates stale pantry value", () => {
  const app = read("src/App.tsx");
  assert.match(
    app,
    /\.\.\.item,[\s\S]*?quantity: newQty,[\s\S]*?estimatedCostEUR: null,/,
  );
});
