import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("guest manual quantity edit reconciles derived recipes and meal plan from updated pantry", () => {
  assert.match(
    app,
    /const updatedPantry = prev\.map\([\s\S]*?estimatedCostEUR: null[\s\S]*?reconcileGuestPantryDerivedState\(updatedPantry\);[\s\S]*?return updatedPantry;/,
  );
});

test("guest manual delete reconciles derived recipes and meal plan from remaining pantry", () => {
  assert.match(
    app,
    /const updatedPantry = prev\.filter\(\(item\) => item\.id !== id\);\s*reconcileGuestPantryDerivedState\(updatedPantry\);\s*return updatedPantry;/,
  );
});

test("successful guest recipe cook reconciles exact post-deduction pantry", () => {
  assert.match(
    app,
    /if \(result\.issues\.length > 0\)[\s\S]*?setPantry\(result\.pantry\);\s*reconcileGuestPantryDerivedState\(result\.pantry\);/,
  );
});

test("successful guest voice removal reconciles exact post-deduction pantry", () => {
  assert.match(
    app,
    /if \(guestResult\.issues\.length > 0 \|\| guestResult\.deductions\.length === 0\)[\s\S]*?setPantry\(guestResult\.pantry\);\s*reconcileGuestPantryDerivedState\(guestResult\.pantry\);/,
  );
});

test("signed-in derived propagation remains listener-gated", () => {
  assert.match(
    app,
    /if \(!inventoryHydrated \|\| !inventoryServerConfirmed\) return;[\s\S]*?isExpectedInventoryResultVisible/,
  );
});
