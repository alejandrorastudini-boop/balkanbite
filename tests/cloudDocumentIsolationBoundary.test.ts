import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const syncSource = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url),
  "utf8",
);

test("all cloud-backed collections query by owner and write user-scoped document ids", () => {
  assert.match(
    syncSource,
    /where\("userId",\s*"==",\s*currentUser\.uid\)/,
  );
  assert.match(
    syncSource,
    /const documentId = getScopedDocumentId\(currentUser\.uid, logicalId\);/,
  );
  assert.match(
    syncSource,
    /getScopedDocumentId\(\s*currentUser\.uid,\s*getSyncedItemKey\(collectionName, item\)!\s*\)/,
  );
  assert.doesNotMatch(
    syncSource,
    /const documentId = isInventory\s*\?/,
  );
});
