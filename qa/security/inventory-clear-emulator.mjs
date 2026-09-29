import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  persistVerifiedPantryClear,
} from "../../src/utils/inventoryClearFirestore.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-clear-pantry",
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

const scoped = (uid, logicalId) =>
  `u_${encodeURIComponent(uid)}__${encodeURIComponent(logicalId)}`;
const stockRef = (db, uid, id) => doc(db, "inventory", scoped(uid, id));
const journalRef = (db, uid, id) => doc(db, "inventoryClears", scoped(uid, id));

async function seed(uid, id, quantity, unit, cookRevision = 0) {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(stockRef(context.firestore(), uid, id), {
      id,
      userId: uid,
      name: "Synthetic stock",
      quantity,
      unit,
      category: "Pantry/Grains",
      addedAt: "2026-09-29",
      cookRevision,
      _deleted: false,
      deletedAt: null,
    });
  });
}

async function readStock(db, uid, id) {
  const snap = await getDoc(stockRef(db, uid, id));
  return snap.exists() ? snap.data() : null;
}

const expected = (pantryItemId, quantity, unit, cookRevision) => ({
  pantryItemId,
  quantity,
  unit,
  cookRevision,
});

try {
  await seed("alice", "rice", 500, "g", 2);
  await seed("alice", "purchase-shopping:s2", 1, "L", 0);

  const request = {
    userId: "alice",
    mutationId: "clear-1",
    expectedStock: [
      expected("rice", 500, "g", 2),
      expected("purchase-shopping:s2", 1, "L", 0),
    ],
  };

  const first = await persistVerifiedPantryClear(alice, request);
  assert.equal(first.outcome, "recorded");
  assert.deepEqual(
    [...first.clearedItemIds].sort(),
    ["purchase-shopping:s2", "rice"],
  );
  const rice = await readStock(alice, "alice", "rice");
  assert.equal(rice.quantity, 0);
  assert.equal(rice.cookRevision, 3);
  assert.equal(rice._deleted, true);
  const milk = await readStock(alice, "alice", "purchase-shopping:s2");
  assert.equal(milk.quantity, 0);
  assert.equal(milk.cookRevision, 1);
  assert.equal(milk._deleted, true);
  console.log("PASS: clear tombstones exact reviewed baseline including colon IDs");

  const replay = await persistVerifiedPantryClear(aliceOtherDevice, request);
  assert.equal(replay.outcome, "already-recorded");
  assert.equal((await readStock(alice, "alice", "rice")).cookRevision, 3);
  assert.equal(
    (await readStock(alice, "alice", "purchase-shopping:s2")).cookRevision,
    1,
  );
  console.log("PASS: clear replay cannot increment revisions twice");

  const changedReplay = await persistVerifiedPantryClear(alice, {
    ...request,
    expectedStock: [expected("rice", 500, "g", 2)],
  });
  assert.deepEqual(changedReplay, {
    outcome: "needs-review",
    reason: "conflicting-replay",
  });

  await seed("alice", "stale-a", 100, "g", 1);
  await seed("alice", "stale-b", 200, "g", 4);
  const stale = await persistVerifiedPantryClear(alice, {
    userId: "alice",
    mutationId: "clear-stale",
    expectedStock: [
      expected("stale-a", 100, "g", 1),
      expected("stale-b", 250, "g", 3),
    ],
  });
  assert.deepEqual(stale, {
    outcome: "needs-review",
    reason: "stale-stock",
    pantryItemId: "stale-b",
  });
  assert.equal((await readStock(alice, "alice", "stale-a")).quantity, 100);
  assert.equal((await readStock(alice, "alice", "stale-a"))._deleted, false);
  assert.equal((await readStock(alice, "alice", "stale-b")).quantity, 200);
  assert.equal(
    (await getDoc(journalRef(alice, "alice", "clear-stale"))).exists(),
    false,
  );
  console.log("PASS: one stale lot aborts the whole clear");

  await seed("alice", "race-a", 10, "pcs", 0);
  await seed("alice", "race-b", 20, "pcs", 5);
  const raceBaseline = [
    expected("race-a", 10, "pcs", 0),
    expected("race-b", 20, "pcs", 5),
  ];
  const race = await Promise.all([
    persistVerifiedPantryClear(alice, {
      userId: "alice",
      mutationId: "clear-race-a",
      expectedStock: raceBaseline,
    }),
    persistVerifiedPantryClear(aliceOtherDevice, {
      userId: "alice",
      mutationId: "clear-race-b",
      expectedStock: raceBaseline,
    }),
  ]);
  assert.equal(race.filter(result => result.outcome === "recorded").length, 1);
  assert.equal(
    race.filter(result =>
      result.outcome === "needs-review" &&
      (result.reason === "invalid-stock" ||
        result.reason === "stale-stock")).length,
    1,
  );
  assert.equal((await readStock(alice, "alice", "race-a"))._deleted, true);
  assert.equal((await readStock(alice, "alice", "race-b"))._deleted, true);
  const raceJournalCount =
    Number((await getDoc(journalRef(alice, "alice", "clear-race-a"))).exists()) +
    Number((await getDoc(journalRef(alice, "alice", "clear-race-b"))).exists());
  assert.equal(raceJournalCount, 1);
  console.log("PASS: concurrent clear actions cannot double-clear revisions");

  await seed("alice", "baseline-only", 3, "pcs", 0);
  const exactBaselineRequest = {
    userId: "alice",
    mutationId: "clear-preserve-new",
    expectedStock: [expected("baseline-only", 3, "pcs", 0)],
  };
  await seed("alice", "created-after-review", 7, "pcs", 0);
  const exact = await persistVerifiedPantryClear(alice, exactBaselineRequest);
  assert.equal(exact.outcome, "recorded");
  assert.equal(
    (await readStock(alice, "alice", "baseline-only"))._deleted,
    true,
  );
  assert.equal(
    (await readStock(alice, "alice", "created-after-review")).quantity,
    7,
  );
  assert.equal(
    (await readStock(alice, "alice", "created-after-review"))._deleted,
    false,
  );
  console.log("PASS: stock outside reviewed baseline is preserved");

  await seed("bob", "private", 4, "pcs", 0);
  await assert.rejects(
    persistVerifiedPantryClear(bob, {
      userId: "alice",
      mutationId: "clear-cross",
      expectedStock: [expected("private", 4, "pcs", 0)],
    }),
    error => error?.code === "permission-denied",
  );
  await assert.rejects(
    persistVerifiedPantryClear(guest, {
      userId: "alice",
      mutationId: "clear-guest",
      expectedStock: [expected("private", 4, "pcs", 0)],
    }),
    error => error?.code === "permission-denied",
  );
  assert.equal((await readStock(bob, "bob", "private")).quantity, 4);
  console.log("PASS: pantry clear remains owner-only");
} finally {
  await environment.cleanup();
}
