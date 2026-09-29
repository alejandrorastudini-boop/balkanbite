import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  persistConfirmedCookAtomically,
  cookRequestSignature,
} from "../../src/utils/confirmedCookFirestore.ts";

const hostPort =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-cook-atomic",
  firestore: {
    host: hostPort[0],
    port: Number(hostPort[1]),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

const alice = environment.authenticatedContext("alice").firestore();
const aliceSecondDevice = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const guest = environment.unauthenticatedContext().firestore();

const inventory = (db, uid, id) => doc(db, "inventory", `u_${uid}__${id}`);
const journal = (db, uid, id) => doc(db, "cookConfirmations", `u_${uid}__${id}`);

const allocation = (ingredientId, pantryItemId, quantity, unit) => ({
  ingredientId,
  pantryItemId,
  quantity,
  unit,
});

const confirmation = (id, mealId, ingredients) => ({
  cookConfirmationId: id,
  mealId,
  ingredients,
  confirmed: true,
});

const expected = (pantryItemId, quantity, unit, cookRevision = 0) => ({
  pantryItemId,
  quantity,
  unit,
  cookRevision,
});

const request = (userId, cook, expectedStock) => ({
  userId,
  confirmation: cook,
  expectedStock,
});

async function createStock(db, uid, id, quantity, unit, cookRevision = 0) {
  await setDoc(inventory(db, uid, id), {
    id,
    userId: uid,
    name: "QA synthetic pantry",
    quantity,
    unit,
    category: "Pantry/Grains",
    addedAt: "2026-09-23",
    cookRevision,
    _deleted: false,
    deletedAt: null,
  });
}

async function stock(db, uid, id) {
  return (await getDoc(inventory(db, uid, id))).data();
}

async function isRecorded(db, uid, id) {
  return (await getDoc(journal(db, uid, id))).exists();
}

try {
  const revisionProbe = inventory(alice, "alice", "qa-revision-probe");
  await assertSucceeds(setDoc(revisionProbe, {
    id: "qa-revision-probe",
    userId: "alice",
    quantity: 20,
    unit: "g",
    cookRevision: 1,
    _deleted: false,
  }));
  await assertSucceeds(updateDoc(revisionProbe, {
    quantity: 15,
    cookRevision: 2,
  }));
  assert.equal((await getDoc(revisionProbe)).data().cookRevision, 2);
  console.log("PASS: isolated owner inventory revision transition");

  await createStock(alice, "alice", "rice-old", 100, "g", 0);
  await createStock(alice, "alice", "rice-new", 0.2, "kg", 0);

  const cook = confirmation("qa-cook-1", "qa-meal-1", [
    allocation("rice-1", "rice-old", 100, "g"),
    allocation("rice-2", "rice-new", 50, "g"),
  ]);
  const firstRequest = request("alice", cook, [
    expected("rice-old", 100, "g", 0),
    expected("rice-new", 0.2, "kg", 0),
  ]);

  const first = await persistConfirmedCookAtomically(alice, firstRequest);
  assert.equal(first.outcome, "recorded");
  assert.equal((await stock(alice, "alice", "rice-old")).quantity, 0);
  assert.equal((await stock(alice, "alice", "rice-old"))._deleted, true);
  assert.equal((await stock(alice, "alice", "rice-old")).cookRevision, 1);
  assert.ok(
    Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.15) < 1e-9,
  );
  assert.equal((await stock(alice, "alice", "rice-new")).cookRevision, 1);
  assert.equal(await isRecorded(alice, "alice", "qa-cook-1"), true);
  assert.equal(
    (await getDoc(journal(alice, "alice", "qa-cook-1"))).data().requestSignature,
    cookRequestSignature(firstRequest),
  );

  const replay = await persistConfirmedCookAtomically(
    aliceSecondDevice,
    firstRequest,
  );
  assert.equal(replay.outcome, "already-recorded");
  assert.ok(
    Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.15) < 1e-9,
  );
  console.log("PASS: exact cook replay cannot deduct twice");

  for (const changed of [
    request(
      "alice",
      confirmation("qa-cook-1", "qa-meal-1", [
        allocation("rice-1", "rice-old", 100, "g"),
        allocation("rice-2", "rice-new", 60, "g"),
      ]),
      firstRequest.expectedStock,
    ),
    request(
      "alice",
      confirmation("qa-cook-1", "other-meal", cook.ingredients),
      firstRequest.expectedStock,
    ),
    request("alice", cook, [
      expected("rice-old", 100, "g", 0),
      expected("rice-new", 0.25, "kg", 0),
    ]),
  ]) {
    const conflict = await persistConfirmedCookAtomically(alice, changed);
    assert.equal(conflict.outcome, "needs-review");
  }
  assert.equal(
    (await getDoc(journal(alice, "alice", "qa-cook-1"))).data().mealId,
    "qa-meal-1",
  );
  console.log("PASS: same cook ID cannot replay a changed allocation/baseline");

  const nextCook = await persistConfirmedCookAtomically(alice, request(
    "alice",
    confirmation("qa-cook-2", "qa-meal-2", [
      allocation("rice-more", "rice-new", 50, "g"),
    ]),
    [expected("rice-new", 0.15, "kg", 1)],
  ));
  assert.equal(nextCook.outcome, "recorded");
  assert.ok(
    Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.1) < 1e-9,
  );
  assert.equal((await stock(alice, "alice", "rice-new")).cookRevision, 2);
  console.log("PASS: fresh baseline can consume newly versioned stock");

  const staleBatch = writeBatch(alice);
  staleBatch.set(inventory(alice, "alice", "rice-new"), {
    id: "rice-new",
    userId: "alice",
    quantity: 0.2,
    unit: "kg",
  }, { merge: true });
  await assertFails(staleBatch.commit());
  await assertFails(deleteDoc(inventory(alice, "alice", "rice-old")));
  await assertFails(setDoc(inventory(alice, "alice", "rice-new"), {
    id: "rice-new",
    userId: "alice",
    quantity: 0.2,
    unit: "kg",
    cookRevision: 1,
  }, { merge: true }));
  assert.ok(
    Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.1) < 1e-9,
  );
  console.log("PASS: stale legacy snapshot writes remain rejected");

  await createStock(alice, "alice", "baseline-revision", 100, "g", 0);
  await assertSucceeds(updateDoc(
    inventory(alice, "alice", "baseline-revision"),
    { quantity: 100, cookRevision: 1 },
  ));
  const staleRevision = await persistConfirmedCookAtomically(alice, request(
    "alice",
    confirmation("qa-stale-revision", "qa-meal-baseline", [
      allocation("baseline", "baseline-revision", 20, "g"),
    ]),
    [expected("baseline-revision", 100, "g", 0)],
  ));
  assert.equal(staleRevision.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "baseline-revision")).quantity, 100);
  assert.equal(
    await isRecorded(alice, "alice", "qa-stale-revision"),
    false,
  );

  await createStock(alice, "alice", "baseline-quantity", 100, "g", 0);
  await assertSucceeds(updateDoc(
    inventory(alice, "alice", "baseline-quantity"),
    { quantity: 120, cookRevision: 1 },
  ));
  const staleQuantity = await persistConfirmedCookAtomically(alice, request(
    "alice",
    confirmation("qa-stale-quantity", "qa-meal-baseline", [
      allocation("baseline", "baseline-quantity", 20, "g"),
    ]),
    [expected("baseline-quantity", 100, "g", 0)],
  ));
  assert.equal(staleQuantity.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "baseline-quantity")).quantity, 120);
  assert.equal(
    await isRecorded(alice, "alice", "qa-stale-quantity"),
    false,
  );
  console.log("PASS: stale quantity or revision baseline cannot silently cook");

  await createStock(alice, "alice", "shortage", 20, "g", 0);
  const shortage = await persistConfirmedCookAtomically(alice, request(
    "alice",
    confirmation("qa-short", "qa-meal-2", [
      allocation("missing", "shortage", 50, "g"),
    ]),
    [expected("shortage", 20, "g", 0)],
  ));
  assert.equal(shortage.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "shortage")).quantity, 20);
  assert.equal(await isRecorded(alice, "alice", "qa-short"), false);

  const incompatible = await persistConfirmedCookAtomically(alice, request(
    "alice",
    confirmation("qa-volume", "qa-meal-3", [
      allocation("liquid", "shortage", 1, "l"),
    ]),
    [expected("shortage", 20, "g", 0)],
  ));
  assert.equal(incompatible.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "shortage")).quantity, 20);
  assert.equal(await isRecorded(alice, "alice", "qa-volume"), false);
  console.log("PASS: shortage and incompatible-unit rejection");

  await createStock(bob, "bob", "rice-old", 250, "g", 0);
  await assertFails(persistConfirmedCookAtomically(bob, request(
    "alice",
    confirmation("qa-cross", "qa-meal-1", [
      allocation("rice-1", "rice-old", 10, "g"),
    ]),
    [expected("rice-old", 250, "g", 0)],
  )));
  await assertFails(persistConfirmedCookAtomically(guest, request(
    "alice",
    confirmation("qa-guest", "qa-meal-1", [
      allocation("rice-1", "rice-old", 10, "g"),
    ]),
    [expected("rice-old", 250, "g", 0)],
  )));
  assert.equal((await stock(bob, "bob", "rice-old")).quantity, 250);

  const bobCook = await persistConfirmedCookAtomically(bob, request(
    "bob",
    confirmation("qa-bob-cook", "bob-meal", [
      allocation("rice-1", "rice-old", 25, "g"),
    ]),
    [expected("rice-old", 250, "g", 0)],
  ));
  assert.equal(bobCook.outcome, "recorded");
  assert.equal((await stock(bob, "bob", "rice-old")).quantity, 225);
  console.log("PASS: cross-account/guest denied and owner cook accepted");

  await createStock(alice, "alice", "race", 100, "g", 0);
  const raceBaseline = [expected("race", 100, "g", 0)];
  const racers = ["qa-race-a", "qa-race-b"].map(id =>
    persistConfirmedCookAtomically(alice, request(
      "alice",
      confirmation(id, "race-meal", [
        allocation("race-ingredient", "race", 80, "g"),
      ]),
      raceBaseline,
    )),
  );
  const results = await Promise.all(racers);
  assert.deepEqual(
    results.map(result => result.outcome).sort(),
    ["needs-review", "recorded"],
  );
  assert.equal((await stock(alice, "alice", "race")).quantity, 20);
  assert.equal(
    Number(await isRecorded(alice, "alice", "qa-race-a")) +
      Number(await isRecorded(alice, "alice", "qa-race-b")),
    1,
  );
  console.log("PASS: competing cooks cannot overspend one confirmed baseline");

  await createStock(alice, "alice", "shared-confirmation", 100, "g", 0);
  const sharedCook = confirmation(
    "qa-shared-confirmation",
    "qa-shared-meal",
    [allocation("shared-ingredient", "shared-confirmation", 60, "g")],
  );
  const sharedRequest = request(
    "alice",
    sharedCook,
    [expected("shared-confirmation", 100, "g", 0)],
  );
  const simultaneous = await Promise.all([
    persistConfirmedCookAtomically(alice, sharedRequest),
    persistConfirmedCookAtomically(aliceSecondDevice, sharedRequest),
  ]);
  assert.deepEqual(
    simultaneous.map(result => result.outcome).sort(),
    ["already-recorded", "recorded"],
  );
  assert.equal(
    (await stock(alice, "alice", "shared-confirmation")).quantity,
    40,
  );
  assert.equal(
    (await stock(alice, "alice", "shared-confirmation")).cookRevision,
    1,
  );
  assert.equal(
    await isRecorded(
      aliceSecondDevice,
      "alice",
      "qa-shared-confirmation",
    ),
    true,
  );
  console.log("PASS: simultaneous same-ID cook deducts exactly once");

  console.log(
    "PASS: authoritative-baseline atomic cook, replay, conflicts, concurrency and isolation.",
  );
} finally {
  await environment.cleanup();
}
