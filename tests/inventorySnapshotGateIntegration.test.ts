import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8",
);

test("inventory listener rejects cache/pending state before hydration and UI replacement", () => {
  const listener = source.indexOf(
    'onSnapshot(q, { includeMetadataChanges: collectionName === "inventory" }',
  );
  const gate = source.indexOf("if (!serverConfirmed)", listener);
  const remoteEntries = source.indexOf("const remoteEntries = snapshot.docs", listener);
  const hydrated = source.indexOf("setInventoryHydratedUser(currentUser.uid)", listener);
  assert.ok(listener >= 0 && gate > listener);
  assert.ok(remoteEntries > gate && hydrated > remoteEntries);
  const preRemote = source.slice(listener, remoteEntries);
  assert.match(preRemote, /isServerConfirmedInventorySnapshot\(snapshot\.metadata\)/);
  assert.match(preRemote, /setInventoryServerConfirmedUser\(serverConfirmed \? currentUser\.uid : null\)/);
  assert.match(preRemote, /if \(!serverConfirmed\) \{\s*return;\s*\}/);
});

test("pending inventory cannot change last hydrated JSON or local pantry", () => {
  const listener = source.indexOf(
    'onSnapshot(q, { includeMetadataChanges: collectionName === "inventory" }',
  );
  const gate = source.indexOf("if (!serverConfirmed)", listener);
  const json = source.indexOf(
    "lastHydratedCollectionJson.current[collectionName] = remoteJson",
    listener,
  );
  const apply = source.indexOf("setLocalState(itemsWithoutUserId)", listener);
  assert.ok(gate >= 0 && json > gate && apply > json);
});

test("server-confirmed gate preserves timeout and explicit listener error exits", () => {
  assert.match(
    source,
    /setTimeout\(\(\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);[\s\S]*\}, 12_000\);/,
  );
  assert.match(
    source,
    /\}, \(error\) => \{[\s\S]*setInventorySyncErrorUser\(currentUser\.uid\);[\s\S]*setInventoryServerConfirmedUser\(null\);/,
  );
});
