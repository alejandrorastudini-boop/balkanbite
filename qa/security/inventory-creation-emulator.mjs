import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { persistNewInventoryItems } from "../../src/utils/inventoryCreationFirestore.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-stock-create",
  firestore: {
    host,
    port: Number(portText),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

const alice = environment.authenticatedContext("alice").firestore();
const aliceOtherDevice = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const guest = environment.unauthenticatedContext().firestore();
const ref = (db, uid, id) => doc(db, "inventory", `u_${uid}__${id}`);
const item = (id, quantity = 100, unit = "g") => ({
  id,
  name: "Synthetic pantry item",
  quantity,
  unit,
  category: "Pantry/Grains",
  addedAt: "2026-09-28",
});

try {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(ref(context.firestore(), "alice", "versioned-existing"), {
      ...item("versioned-existing", 250, "g"),
      userId: "alice",
      cookRevision: 3,
      _deleted: false,
      deletedAt: null,
    });
  });

  const created = await persistNewInventoryItems(alice, "alice", [
    {
      ...item("new-rice", 500, "g"),
      estimatedCostEUR: 1.5,
      purchaseHistory: [{
        sourceId: "manual-1",
        source: "pantry_legacy",
        name: "Synthetic pantry item",
        quantity: 500,
        unit: "g",
        acquiredAt: "2026-09-28",
      }],
    },
  ]);
  assert.deepEqual(created, { outcome: "created", itemIds: ["new-rice"] });
  const newRice = (await getDoc(ref(alice, "alice", "new-rice"))).data();
  assert.equal(newRice.quantity, 500);
  assert.equal(newRice.cookRevision, 0);
  assert.equal(newRice._deleted, false);
  const existing = (await getDoc(ref(alice, "alice", "versioned-existing"))).data();
  assert.equal(existing.quantity, 250);
  assert.equal(existing.cookRevision, 3);
  console.log("PASS: creating new stock does not rewrite existing versioned inventory");

  const invalid = await persistNewInventoryItems(alice, "alice", [
    item("invalid-zero", 0, "g"),
  ]);
  assert.deepEqual(invalid, { outcome: "needs-review", reason: "invalid-item" });
  assert.equal((await getDoc(ref(alice, "alice", "invalid-zero"))).exists(), false);

  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(ref(context.firestore(), "alice", "duplicate"), {
      ...item("duplicate", 2, "pcs"),
      userId: "alice",
      cookRevision: 0,
      _deleted: false,
      deletedAt: null,
    });
  });
  const atomicDuplicate = await persistNewInventoryItems(alice, "alice", [
    item("must-not-partially-create", 1, "pcs"),
    item("duplicate", 1, "pcs"),
  ]);
  assert.deepEqual(atomicDuplicate, {
    outcome: "needs-review",
    reason: "duplicate-stock",
  });
  assert.equal(
    (await getDoc(ref(alice, "alice", "must-not-partially-create"))).exists(),
    false,
  );
  console.log("PASS: duplicate ID aborts the whole new-stock transaction");

  const concurrent = await Promise.all([
    persistNewInventoryItems(alice, "alice", [item("same-new-id", 3, "pcs")]),
    persistNewInventoryItems(aliceOtherDevice, "alice", [item("same-new-id", 3, "pcs")]),
  ]);
  assert.equal(concurrent.filter(result => result.outcome === "created").length, 1);
  assert.equal(
    concurrent.filter(result =>
      result.outcome === "needs-review" && result.reason === "duplicate-stock").length,
    1,
  );
  assert.equal((await getDoc(ref(alice, "alice", "same-new-id"))).data().quantity, 3);
  console.log("PASS: concurrent owner creation of the same ID produces one document");

  await assert.rejects(
    persistNewInventoryItems(bob, "alice", [item("cross-account", 1, "pcs")]),
    error => error?.code === "permission-denied",
  );
  await assert.rejects(
    persistNewInventoryItems(guest, "alice", [item("guest-write", 1, "pcs")]),
    error => error?.code === "permission-denied",
  );
  assert.equal((await getDoc(ref(alice, "alice", "cross-account"))).exists(), false);\n  assert.equal((await getDoc(ref(alice, "alice", "guest-write"))).exists(), false);\n  console.log("PASS: absent-ID lookup and creation remain owner-only");
} finally {
  await environment.cleanup();
}
