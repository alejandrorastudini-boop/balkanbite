import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("guest manual quantity edit reconciles derived recipes and meal plan from updated pantry", () => {
  assert.match(
    app,
    /const updatedPantry = guestPantryCommittedRef\.current\.map\([\s\S]*?estimatedCostEUR: null[\s\S]*?commitGuestPantry\(updatedPantry\);/,
  );
});

test("guest manual delete reconciles derived recipes and meal plan from remaining pantry", () => {
  assert.match(
    app,
    /const updatedPantry = guestPantryCommittedRef\.current\.filter\(\(item\) => item\.id !== id\);\s*commitGuestPantry\(updatedPantry\);/,
  );
});

test("successful guest recipe cook reconciles exact post-deduction pantry", () => {
  assert.match(
    app,
    /if \(result\.issues\.length > 0\)[\s\S]*?if \(!commitGuestPantry\(result\.pantry\)\) return \{ success: false, issueCount: 1 \};/,
  );
});

test("successful guest voice removal reconciles exact post-deduction pantry", () => {
  assert.match(
    app,
    /if \(guestResult\.issues\.length > 0 \|\| guestResult\.deductions\.length === 0\)[\s\S]*?return commitGuestPantry\(guestResult\.pantry\);/,
  );
});

test("signed-in derived propagation remains listener-gated", () => {
  assert.match(
    app,
    /if \(!inventoryHydrated \|\| !inventoryServerConfirmed\) return;[\s\S]*?isExpectedInventoryResultVisible/,
  );
});
