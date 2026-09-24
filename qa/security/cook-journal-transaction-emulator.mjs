import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  persistConfirmedCookAtomically,
  cookAllocationSignature,
} from "../../src/utils/confirmedCookFirestore.ts";

const hostPort = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-cook-atomic",
  firestore: {
    host: hostPort[0], port: Number(hostPort[1]),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

const alice = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const guest = environment.unauthenticatedContext().firestore();

const inventory = (db, uid, id) => doc(db, "inventory", `u_${uid}__${id}`);
const journal = (db, uid, id) => doc(db, "cookConfirmations", `u_${uid}__${id}`);
const allocation = (ingredientId, pantryItemId, quantity, unit) =>
  ({ ingredientId, pantryItemId, quantity, unit });
const confirmation = (id, mealId, ingredients) =>
  ({ cookConfirmationId: id, mealId, ingredients, confirmed: true });

async function createStock(db, uid, id, quantity, unit) {
  await setDoc(inventory(db, uid, id), {
    id, userId: uid, name: "QA synthetic pantry", quantity, unit,
    category: "Pantry/Grains", addedAt: "2026-09-23", _deleted: false,
  });
}
async function stock(db, uid, id) {
  return (await getDoc(inventory(db, uid, id))).data();
}
async function isRecorded(db, uid, id) {
  return (await getDoc(journal(db, uid, id))).exists();
}

try {
  await createStock(alice, "alice", "rice-old", 100, "g");
  await createStock(alice, "alice", "rice-new", 0.2, "kg");
  const cook = confirmation("qa-cook-1", "qa-meal-1", [
    allocation("rice-1", "rice-old", 100, "g"),
    allocation("rice-2", "rice-new", 50, "g"),
  ]);
  const first = await persistConfirmedCookAtomically(alice, {
    userId: "alice", confirmation: cook,
  });
  assert.equal(first.outcome, "recorded");
  assert.equal((await stock(alice, "alice", "rice-old")).quantity, 0);
  assert.equal((await stock(alice, "alice", "rice-old"))._deleted, true);
  assert.ok(Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.15) < 1e-9);
  assert.equal(await isRecorded(alice, "alice", "qa-cook-1"), true);
  assert.equal((await getDoc(journal(alice, "alice", "qa-cook-1"))).data().requestSignature,
    cookAllocationSignature(cook));

  const replay = await persistConfirmedCookAtomically(alice, {
    userId: "alice", confirmation: cook,
  });
  assert.equal(replay.outcome, "already-recorded");
  assert.ok(Math.abs((await stock(alice, "alice", "rice-new")).quantity - 0.15) < 1e-9);
  for (const changed of [
    confirmation("qa-cook-1", "qa-meal-1", [
      allocation("rice-1", "rice-old", 100, "g"),
      allocation("rice-2", "rice-new", 60, "g"),
    ]),
    confirmation("qa-cook-1", "other-meal", cook.ingredients),
  ]) {
    const conflict = await persistConfirmedCookAtomically(alice, {
      userId: "alice", confirmation: changed,
    });
    assert.equal(conflict.outcome, "needs-review");
  }
  assert.equal((await getDoc(journal(alice, "alice", "qa-cook-1"))).data().mealId, "qa-meal-1");

  await createStock(alice, "alice", "shortage", 20, "g");
  const shortage = await persistConfirmedCookAtomically(alice, {
    userId: "alice",
    confirmation: confirmation("qa-short", "qa-meal-2", [
      allocation("missing", "shortage", 50, "g"),
    ]),
  });
  assert.equal(shortage.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "shortage")).quantity, 20);
  assert.equal(await isRecorded(alice, "alice", "qa-short"), false);

  const incompatible = await persistConfirmedCookAtomically(alice, {
    userId: "alice",
    confirmation: confirmation("qa-volume", "qa-meal-3", [
      allocation("liquid", "shortage", 1, "l"),
    ]),
  });
  assert.equal(incompatible.outcome, "needs-review");
  assert.equal((await stock(alice, "alice", "shortage")).quantity, 20);
  assert.equal(await isRecorded(alice, "alice", "qa-volume"), false);

  // An authenticated user can only write to their own namespace.
  await createStock(bob, "bob", "rice-old", 250, "g");
  await assertFails(persistConfirmedCookAtomically(bob, {
    userId: "alice",
    confirmation: confirmation("qa-cook-1", "qa-meal-1", [
      allocation("rice-1", "rice-old", 10, "g"),
    ]),
  }));
  await assertFails(persistConfirmedCookAtomically(guest, {
    userId: "alice",
    confirmation: confirmation("qa-cook-1", "qa-meal-1", [
      allocation("rice-1", "rice-old", 10, "g"),
    ]),
  }));
  assert.equal((await stock(bob, "bob", "rice-old")).quantity, 250);

  const bobCook = await persistConfirmedCookAtomically(bob, {
    userId: "bob",
    confirmation: confirmation("qa-cook-1", "bob-meal", [
      allocation("rice-1", "rice-old", 25, "g"),
    ]),
  });
  assert.equal(bobCook.outcome, "recorded");
  assert.equal((await stock(bob, "bob", "rice-old")).quantity, 225);

  // Two different confirmations race to consume the same 100g lot.
  await createStock(alice, "alice", "race", 100, "g");
  const racers = ["qa-race-a", "qa-race-b"].map(id =>
    persistConfirmedCookAtomically(alice, {
      userId: "alice",
      confirmation: confirmation(id, "race-meal", [
        allocation("race-ingredient", "race", 80, "g"),
      ]),
    }),
  );
  const results = await Promise.all(racers);
  assert.deepEqual(results.map(x => x.outcome).sort(), ["needs-review", "recorded"]);
  assert.equal((await stock(alice, "alice", "race")).quantity, 20);
  const journalCount = Number(await isRecorded(alice, "alice", "qa-race-a")) +
    Number(await isRecorded(alice, "alice", "qa-race-b"));
  assert.equal(journalCount, 1);

  console.log("PASS: atomic owner-scoped cook inventory+journal, replay, conflicts, multi-lot, A/B isolation.");
} finally {
  await environment.cleanup();
}
