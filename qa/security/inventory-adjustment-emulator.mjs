import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import {
  persistVerifiedInventoryAdjustment,
} from "../../src/utils/inventoryAdjustmentFirestore.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-stock-edit",
  firestore: {
    host, port: Number(portText),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

const alice = environment.authenticatedContext("alice").firestore();
const aliceOtherDevice = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const guest = environment.unauthenticatedContext().firestore();
const lot = (db, owner, id) => doc(db, "inventory", `u_${owner}__${id}`);
const readLot = async (db, owner, id) => (await getDoc(lot(db, owner, id))).data();
const expected = (pantryItemId, quantity, unit, cookRevision) =>
  ({ pantryItemId, quantity, unit, cookRevision });

try {
  // Explicit owner-verified stock after an earlier cook has versioned its lot.
  await setDoc(lot(alice, "alice", "rice"), {
    id: "rice", userId: "alice", name: "Synthetic rice",
    quantity: 100, unit: "g", category: "Pantry/Grains",
    addedAt: "2026-09-24", cookRevision: 1, _deleted: false,
  });
  const baseline = expected("rice", 100, "g", 1);
  const first = await persistVerifiedInventoryAdjustment(
    alice, "alice", baseline, { kind: "set-quantity", quantity: 80 },
  );
  assert.deepEqual(first, { outcome: "updated", quantity: 80, cookRevision: 2 });
  assert.equal((await readLot(alice, "alice", "rice")).quantity, 80);
  assert.equal((await readLot(alice, "alice", "rice")).cookRevision, 2);

  // Neither our writer nor the unmodified legacy all-row batch may restore
  // a previously seen quantity once another transaction modified the lot.
  const oldEdit = await persistVerifiedInventoryAdjustment(
    aliceOtherDevice, "alice", baseline,
    { kind: "set-quantity", quantity: 90 },
  );
  assert.deepEqual(oldEdit, { outcome: "needs-review", reason: "stale-stock" });
  const staleBatch = writeBatch(aliceOtherDevice);
  staleBatch.set(lot(aliceOtherDevice, "alice", "rice"), {
    id: "rice", userId: "alice", quantity: 100, unit: "g",
  }, { merge: true });
  await assertFails(staleBatch.commit());
  assert.equal((await readLot(alice, "alice", "rice")).quantity, 80);

  const secondBaseline = expected("rice", 80, "g", 2);
  const concurrent = await Promise.all([
    persistVerifiedInventoryAdjustment(alice, "alice", secondBaseline,
      { kind: "set-quantity", quantity: 60 }),
    persistVerifiedInventoryAdjustment(aliceOtherDevice, "alice", secondBaseline,
      { kind: "set-quantity", quantity: 50 }),
  ]);
  assert.deepEqual(concurrent.map(result => result.outcome).sort(),
    ["needs-review", "updated"]);
  const actual = await readLot(alice, "alice", "rice");
  assert.equal(actual.cookRevision, 3);
  assert.ok([50, 60].includes(actual.quantity));
  assert.equal(concurrent.find(result => result.outcome === "needs-review").reason,
    "stale-stock");

  // Removal must be a versioned tombstone, never an unsafe direct delete.
  const removal = await persistVerifiedInventoryAdjustment(
    alice, "alice", expected("rice", actual.quantity, "g", 3),
    { kind: "remove" },
  );
  assert.deepEqual(removal, { outcome: "removed", cookRevision: 4 });
  const removed = await readLot(alice, "alice", "rice");
  assert.equal(removed.quantity, 0);
  assert.equal(removed._deleted, true);
  assert.equal(removed.cookRevision, 4);
  await assertFails(deleteDoc(lot(alice, "alice", "rice")));
  assert.equal((await persistVerifiedInventoryAdjustment(
    alice, "alice", expected("rice", actual.quantity, "g", 3),
    { kind: "set-quantity", quantity: 100 },
  )).outcome, "needs-review");
  console.log("PASS: versioned update, stale-batch rejection, concurrency and tombstone");

  // Legacy unversioned stock may be migrated on its first explicit adjustment.
  await setDoc(lot(alice, "alice", "unversioned"), {
    id: "unversioned", userId: "alice", quantity: 0.5, unit: "kg",
  });
  const migrate = await persistVerifiedInventoryAdjustment(
    alice, "alice", expected("unversioned", 0.5, "kg", 0),
    { kind: "set-quantity", quantity: 0.6 },
  );
  assert.equal(migrate.outcome, "updated");
  assert.equal((await readLot(alice, "alice", "unversioned")).cookRevision, 1);
  assert.deepEqual(await persistVerifiedInventoryAdjustment(
    alice, "alice", expected("unversioned", 0.6, "g", 1),
    { kind: "set-quantity", quantity: 0.7 },
  ), { outcome: "needs-review", reason: "stale-stock" });

  // Bad/missing baseline is never converted to guessed revision zero.
  assert.deepEqual(await persistVerifiedInventoryAdjustment(
    alice, "alice", expected("unversioned", 0.6, "kg", undefined),
    { kind: "set-quantity", quantity: 0.7 },
  ), { outcome: "needs-review", reason: "invalid-request" });

  // The same API cannot be used to mutate another account's inventory.
  await setDoc(lot(bob, "bob", "private"), {
    id: "private", userId: "bob", quantity: 5, unit: "pcs",
  });
  await assertFails(persistVerifiedInventoryAdjustment(
    alice, "bob", expected("private", 5, "pcs", 0),
    { kind: "set-quantity", quantity: 4 },
  ));
  await assertFails(persistVerifiedInventoryAdjustment(
    guest, "bob", expected("private", 5, "pcs", 0),
    { kind: "remove" },
  ));
  assert.equal((await readLot(bob, "bob", "private")).quantity, 5);
  console.log("PASS: legacy first adjustment and Alice/Bob/guest separation");
} finally {
  await environment.cleanup();
}
