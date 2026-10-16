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
  const start = app.indexOf("const handleVoiceDeductItems");
  const end = app.indexOf("const handleVoiceNavigateToRecipes", start);
  const flow = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(flow, /const result = deductVoiceItemsFromPantry\(/);
  assert.match(flow, /const saved = commitGuestVoiceRemoval\(localStorage, \{/);
  assert.match(flow, /expectedPantry: pantryBaseline/);
  assert.match(flow, /setPantry\(committedPantry\.items\)/);
  assert.ok(flow.indexOf("commitGuestVoiceRemoval(localStorage") <
    flow.indexOf("setPantry(committedPantry.items)"));
});

test("signed-in derived propagation remains listener-gated", () => {
  assert.match(
    app,
    /if \(!inventoryHydrated \|\| !inventoryServerConfirmed\) return;[\s\S]*?isExpectedInventoryResultVisible/,
  );
});
