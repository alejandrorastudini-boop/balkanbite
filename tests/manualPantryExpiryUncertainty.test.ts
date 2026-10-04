import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("guest and signed-in manual quantity edits share expiry partial boundary", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const firestore = fs.readFileSync(
    "src/utils/inventoryAdjustmentFirestore.ts",
    "utf8",
  );

  assert.match(
    app,
    /shouldMarkExpiryPartialAfterQuantityIncrease\(\s*item\.quantity,\s*newQty,\s*item\.expiryDaysLeft,/,
  );
  assert.match(
    firestore,
    /shouldMarkExpiryPartialAfterQuantityIncrease\(\s*expected\.quantity,\s*adjustment\.quantity,\s*remote\.expiryDaysLeft,/,
  );
  assert.match(firestore, /\? \{ expiryIsPartial: true \}/);
});
