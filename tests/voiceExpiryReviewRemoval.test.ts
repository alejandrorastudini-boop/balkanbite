import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import { deductVoiceItemsFromPantry } from "../src/utils/pantryConsumption";

test("confirmed voice deduction may remove expiry-review stock", () => {
  const pantry: PantryItem[] = [{
    id: "review-stock",
    name: "Rice",
    quantity: 100,
    unit: "g",
    category: "Pantry/Grains",
    addedAt: "2026-10-01",
    expiryDaysLeft: 1,
  }];

  const result = deductVoiceItemsFromPantry(
    pantry,
    [{ name: "Rice", quantity: 100, unit: "g" }],
    new Date("2026-10-04T12:00:00.000Z"),
  );

  assert.deepEqual(result.issues, []);
  assert.equal(result.pantry.length, 0);
  assert.equal(result.deductions[0]?.pantryItemId, "review-stock");
});
