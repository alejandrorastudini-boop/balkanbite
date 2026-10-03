import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { persistInventoryClearAtomically } from "../../src/utils/inventoryClearFirestore.ts";
import { getScopedDocumentId } from "../../src/utils/cloudCollectionSync.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-clear-all",
  firestore: {
    host, port: Number(portText),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});
const alice = environment.authenticatedContext("alice").firestore();
const aliceOther = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const lot = (db, owner, id) => doc(db, "inventory", getScopedDocumentId(owner, id));
const journal = (db, owner, id) =>
  doc(db, "inventoryClearApplications", getScopedDocumentId(owner, id));
const baseline = [
  { pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 1 },
  { pantryItemId: "milk", quantity: 1, unit: "L", cookRevision: 0 },
];

try {
  await setDoc(lot(alice, "alice", "rice"), {
    id: "rice", userId: "alice", name: "Synthetic rice", quantity: 100, unit: "g",
    category: "Pantry/Grains", addedAt: "2026-10-03",
    cookRevision: 1, _deleted: false,
  });
  await setDoc(lot(alice, "alice", "milk"), {
    id: "milk", userId: "alice", name: "Synthetic milk", quantity: 1, unit: "L",
    category: "Dairy", addedAt: "2026-10-03",
    cookRevision: 0, _deleted: false,
  });

  const first = await persistInventoryClearAtomically(alice, {
    userId: "alice", mutationId: "clear-1", baseline,
  });
  assert.deepEqual(first, { outcome: "cleared", clearedIds: ["milk", "rice"] });
  for (const row of baseline) {
    const data = (await getDoc(lot(alice, "alice", row.pantryItemId))).data();
    assert.equal(data._deleted, true);
    assert.equal(data.quantity, 0);
    assert.equal(data.cookRevision, row.cookRevision + 1);
  }

  const replay = await persistInventoryClearAtomically(aliceOther, {
    userId: "alice", mutationId: "clear-1", baseline,
  });
  assert.equal(replay.outcome, "already-cleared");

  // Same immutable id with changed payload cannot clear unrelated/new stock.
  const changedReplay = await persistInventoryClearAtomically(aliceOther, {
    userId: "alice", mutationId: "clear-1",
    baseline: [{ pantryItemId: "new", quantity: 1, unit: "pcs", cookRevision: 0 }],
  });
  assert.deepEqual(changedReplay, { outcome: "needs-review", reason: "invalid-request" });

  await setDoc(lot(alice, "alice", "a"), {
    id: "a", userId: "alice", quantity: 2, unit: "pcs",
    cookRevision: 0, _deleted: false,
  });
  await setDoc(lot(alice, "alice", "b"), {
    id: "b", userId: "alice", quantity: 3, unit: "pcs",
    cookRevision: 0, _deleted: false,
  });
  const stale = [
    { pantryItemId: "a", quantity: 2, unit: "pcs", cookRevision: 0 },
    { pantryItemId: "b", quantity: 3, unit: "pcs", cookRevision: 0 },
  ];
  await updateDoc(lot(aliceOther, "alice", "b"), {
    quantity: 4, cookRevision: 1,
  });
  const rejected = await persistInventoryClearAtomically(alice, {
    userId: "alice", mutationId: "clear-stale", baseline: stale,
  });
  assert.deepEqual(rejected, { outcome: "needs-review", reason: "stale-stock" });
  assert.equal((await getDoc(lot(alice, "alice", "a"))).data()._deleted, false);
  assert.equal((await getDoc(lot(alice, "alice", "b"))).data()._deleted, false);
  assert.equal((await getDoc(journal(alice, "alice", "clear-stale"))).exists(), false);

  await setDoc(lot(bob, "bob", "private"), {
    id: "private", userId: "bob", quantity: 5, unit: "pcs",
    cookRevision: 0, _deleted: false,
  });
  await assertFails(persistInventoryClearAtomically(alice, {
    userId: "bob", mutationId: "clear-bob",
    baseline: [{ pantryItemId: "private", quantity: 5, unit: "pcs", cookRevision: 0 }],
  }));
  assert.equal((await getDoc(lot(bob, "bob", "private"))).data().quantity, 5);

  // Journals are immutable even to their owner.
  await assertFails(updateDoc(journal(alice, "alice", "clear-1"), {
    requestSignature: "tampered",
  }));
  console.log("PASS: atomic Clear-All, replay, stale all-or-nothing and owner isolation");
} finally {
  await environment.cleanup();
}
