import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("cloud recipe snapshots use the persisted recipe structure predicate", () => {
  assert.match(
    source,
    /isStoredRecipeStructurallyValid.*storedRecipeValidation/,
  );
  assert.match(
    source,
    /syncCollection\(\s*"recipes",\s*recipes,\s*setRecipes,\s*\(\) => true,\s*true,\s*isStoredRecipeStructurallyValid\s*\)/,
  );
});

test("remote acceptance happens before canonical document tracking", () => {
  const acceptanceIndex = source.indexOf(
    ".filter(({ item }) => shouldAcceptRemoteItem(item))",
  );
  const canonicalSelectionIndex = source.indexOf(
    "selectCanonicalRemoteEntries(",
    acceptanceIndex,
  );

  assert.ok(acceptanceIndex >= 0);
  assert.ok(canonicalSelectionIndex > acceptanceIndex);
});

test("malformed remote recipe rows are not added to tracked document ids", () => {
  const acceptanceIndex = source.indexOf(
    ".filter(({ item }) => shouldAcceptRemoteItem(item))",
  );
  const trackedIndex = source.indexOf(
    "hydratedCollectionDocumentIds.current[collectionName] = new Set(",
    acceptanceIndex,
  );

  assert.ok(acceptanceIndex >= 0);
  assert.ok(trackedIndex > acceptanceIndex);
});
