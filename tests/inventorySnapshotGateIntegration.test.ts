import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("inventory listener rejects cached or pending snapshot before hydration/write authority", () => {
  const listener = source.indexOf(
    'onSnapshot(q, { includeMetadataChanges: collectionName === "inventory" }',
  );
  const remoteEntries = source.indexOf("const remoteEntries = snapshot.docs", listener);
  const hydrated = source.indexOf(
    "setInventoryHydratedUser(currentUser.uid)",
    listener,
  );
  assert.ok(listener >= 0 && remoteEntries > listener && hydrated > remoteEntries);
  const preRemote = source.slice(listener, remoteEntries);
  assert.match(preRemote, /verifyServerInventoryForEdits\(/);
  assert.match(
    preRemote,
    /if \(!isServerConfirmedInventorySnapshot\(snapshot\.metadata\)\) \{\s*return;\s*\}/,
  );
});

test("pending local inventory cannot replace last hydrated JSON or call setLocalState", () => {
  const listener = source.indexOf(
    'onSnapshot(q, { includeMetadataChanges: collectionName === "inventory" }',
  );
  const gate = source.indexOf(
    "if (!isServerConfirmedInventorySnapshot(snapshot.metadata))",
    listener,
  );
  const hydratedJson = source.indexOf(
    "lastHydratedCollectionJson.current[collectionName] = remoteJson",
    listener,
  );
  const apply = source.indexOf("setLocalState(itemsWithoutUserId)", listener);
  assert.ok(listener >= 0 && gate > listener);
  assert.ok(hydratedJson > gate && apply > hydratedJson);
});

test("inventory authority gate does not weaken timeout/error fail-closed path", () => {
  assert.match(
    source,
    /setTimeout\(\(\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);[\s\S]*\}, 12_000\);/,
  );
  assert.match(
    source,
    /\}, \(error\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);[\s\S]*inventoryEditAuthority\.current = \{[\s\S]*reason: "unverified-snapshot"/,
  );
});
