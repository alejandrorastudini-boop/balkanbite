import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);
const purchaseSource = readFileSync(
  new URL("../src/utils/purchasePantryMerge.ts", import.meta.url),
  "utf8",
);

test("guest shopping startup uses the domain cache parser", () => {
  const start = appSource.indexOf("const [shoppingList, setShoppingList]");
  const end = appSource.indexOf("const [mealPlan", start);
  assert.ok(start >= 0 && end > start);

  const initializer = appSource.slice(start, end);
  assert.match(initializer, /parseStoredShoppingCache/);
  assert.match(initializer, /\?\? \[\]/);
  assert.doesNotMatch(initializer, /JSON\.parse/);
});

test("guest workspace shopping rehydration no longer uses the generic array cast", () => {
  assert.match(
    appSource,
    /parseStoredShoppingCache\(localStorage\.getItem\("balkanbite_shopping"\)\)/,
  );
  assert.doesNotMatch(appSource, /parseArrayCache<ShoppingItem>/);
});

test("cloud shopping snapshots use the persisted shopping predicate", () => {
  assert.match(
    syncSource,
    /isStoredShoppingItemStructurallyValid.*storedShoppingValidation/,
  );
  assert.match(
    syncSource,
    /syncCollection\(\s*"shoppingList",\s*shoppingList,\s*setShoppingList,\s*\(\) => true,\s*true,\s*isStoredShoppingItemStructurallyValid\s*\)/,
  );
});

test("remote shopping filtering occurs before canonical document tracking", () => {
  const acceptanceIndex = syncSource.indexOf(
    ".filter(({ item }) => shouldAcceptRemoteItem(item))",
  );
  const trackingIndex = syncSource.indexOf(
    "hydratedCollectionDocumentIds.current[collectionName] = new Set(",
    acceptanceIndex,
  );

  assert.ok(acceptanceIndex >= 0);
  assert.ok(trackingIndex > acceptanceIndex);
});

test("shopping persistence validity does not bypass purchase confirmation", () => {
  assert.match(
    purchaseSource,
    /const confirmedItems = checkedItems\.filter\([\s\S]*purchaseAmountConfirmed === true/,
  );
  assert.match(
    purchaseSource,
    /filter\(\(item\) => item\.purchaseAmountConfirmed !== true\)/,
  );
});
