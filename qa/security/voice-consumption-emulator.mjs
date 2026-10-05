import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  persistVerifiedVoiceConsumption,
  voiceConsumptionSignature,
} from "../../src/utils/verifiedVoiceConsumptionFirestore.ts";
import { getScopedDocumentId } from "../../src/utils/cloudCollectionSync.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-voice-consumption",
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

const stockRef = (db, uid, id) => doc(db, "inventory", getScopedDocumentId(uid, id));
const journalRef = (db, uid, id) =>
  doc(db, "inventoryConsumptions", getScopedDocumentId(uid, id));

const expectation = (pantryItemId, quantity, unit, cookRevision) => ({
  pantryItemId, quantity, unit, cookRevision,
});
const deduction = (ingredientName, pantryItemId, consumedQuantity, unit) => ({
  ingredientName, pantryItemId, consumedQuantity, unit,
});
const request = (mutationId, expectedStock, deductions, purpose = "food-use") => ({
  userId: "alice", mutationId, purpose, expectedStock, deductions,
});

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

async function stock(db, uid, id) {
  return (await getDoc(stockRef(db, uid, id))).data();
}

try {
  await seed("alice", "rice-old", 100, "g", 2);
  await seed("alice", "rice-new", 200, "g", 4);

  const voice = request(
    "voice-remove-1",
    [
      expectation("rice-old", 100, "g", 2),
      expectation("rice-new", 200, "g", 4),
    ],
    [
      deduction("rice", "rice-old", 100, "g"),
      deduction("rice", "rice-new", 50, "g"),
    ],
  );

  assert.ok(voiceConsumptionSignature(voice));
  const first = await persistVerifiedVoiceConsumption(alice, voice);
  assert.equal(first.outcome, "recorded");
  assert.equal((await stock(alice, "alice", "rice-old")).quantity, 0);
  assert.equal((await stock(alice, "alice", "rice-old"))._deleted, true);
  assert.equal((await stock(alice, "alice", "rice-old")).cookRevision, 3);
  assert.equal((await stock(alice, "alice", "rice-new")).quantity, 150);
  assert.equal((await stock(alice, "alice", "rice-new")).cookRevision, 5);

  const journal = await getDoc(journalRef(alice, "alice", "voice-remove-1"));
  assert.equal(journal.exists(), true);
  assert.equal(journal.data().source, "voice");
  assert.equal(journal.data().requestSignature, voiceConsumptionSignature(voice));

  const replay = await persistVerifiedVoiceConsumption(aliceOtherDevice, voice);
  assert.equal(replay.outcome, "already-recorded");
  assert.equal((await stock(alice, "alice", "rice-new")).quantity, 150);
  assert.equal((await stock(alice, "alice", "rice-new")).cookRevision, 5);
  console.log("PASS: exact multi-lot voice deduction and replay deduct only once");

  const changedReplay = await persistVerifiedVoiceConsumption(alice, {
    ...voice,
    deductions: [
      deduction("rice", "rice-old", 100, "g"),
      deduction("rice", "rice-new", 60, "g"),
    ],
  });
  assert.deepEqual(changedReplay, {
    outcome: "needs-review",
    reason: "conflicting-replay",
  });
  assert.equal((await stock(alice, "alice", "rice-new")).quantity, 150);

  const changedPurposeReplay = await persistVerifiedVoiceConsumption(alice, {
    ...voice,
    purpose: "discard",
  });
  assert.deepEqual(changedPurposeReplay, {
    outcome: "needs-review",
    reason: "conflicting-replay",
  });
  assert.equal((await stock(alice, "alice", "rice-new")).quantity, 150);

  await seed("alice", "stale", 100, "g", 3);
  const stale = await persistVerifiedVoiceConsumption(
    alice,
    request(
      "voice-stale",
      [expectation("stale", 120, "g", 2)],
      [deduction("rice", "stale", 20, "g")],
    ),
  );
  assert.deepEqual(stale, {
    outcome: "needs-review",
    reason: "stale-stock",
    pantryItemId: "stale",
  });
  assert.equal((await stock(alice, "alice", "stale")).quantity, 100);
  assert.equal((await getDoc(journalRef(alice, "alice", "voice-stale"))).exists(), false);

  await seed("alice", "short", 40, "g", 0);
  const shortage = await persistVerifiedVoiceConsumption(
    alice,
    request(
      "voice-short",
      [expectation("short", 40, "g", 0)],
      [deduction("rice", "short", 50, "g")],
    ),
  );
  assert.deepEqual(shortage, {
    outcome: "needs-review",
    reason: "insufficient-quantity",
    pantryItemId: "short",
  });
  assert.equal((await stock(alice, "alice", "short")).quantity, 40);
  assert.equal((await getDoc(journalRef(alice, "alice", "voice-short"))).exists(), false);

  await seed("alice", "unit", 2, "pcs", 0);
  const badUnit = await persistVerifiedVoiceConsumption(
    alice,
    request(
      "voice-unit",
      [expectation("unit", 2, "pcs", 0)],
      [deduction("eggs", "unit", 1, "g")],
    ),
  );
  assert.deepEqual(badUnit, {
    outcome: "needs-review",
    reason: "incompatible-unit",
    pantryItemId: "unit",
  });
  assert.equal((await stock(alice, "alice", "unit")).quantity, 2);

  await seed("alice", "race", 100, "g", 0);
  const raceBaseline = [expectation("race", 100, "g", 0)];
  const race = await Promise.all([
    persistVerifiedVoiceConsumption(
      alice,
      request(
        "voice-race-a",
        raceBaseline,
        [deduction("rice", "race", 80, "g")],
      ),
    ),
    persistVerifiedVoiceConsumption(
      aliceOtherDevice,
      request(
        "voice-race-b",
        raceBaseline,
        [deduction("rice", "race", 80, "g")],
      ),
    ),
  ]);
  assert.equal(race.filter(result => result.outcome === "recorded").length, 1);
  assert.equal(
    race.filter(result =>
      result.outcome === "needs-review" &&
      result.reason === "stale-stock").length,
    1,
  );
  assert.equal((await stock(alice, "alice", "race")).quantity, 20);
  const raceJournalCount =
    Number((await getDoc(journalRef(alice, "alice", "voice-race-a"))).exists()) +
    Number((await getDoc(journalRef(alice, "alice", "voice-race-b"))).exists());
  assert.equal(raceJournalCount, 1);
  console.log("PASS: concurrent distinct voice removals cannot overspend stock");

  await seed("alice", "same-id", 100, "g", 0);
  const sameRequest = request(
    "voice-same-id",
    [expectation("same-id", 100, "g", 0)],
    [deduction("rice", "same-id", 60, "g")],
  );
  const same = await Promise.all([
    persistVerifiedVoiceConsumption(alice, sameRequest),
    persistVerifiedVoiceConsumption(aliceOtherDevice, sameRequest),
  ]);
  assert.deepEqual(
    same.map(result => result.outcome).sort(),
    ["already-recorded", "recorded"],
  );
  assert.equal((await stock(alice, "alice", "same-id")).quantity, 40);
  assert.equal((await stock(alice, "alice", "same-id")).cookRevision, 1);
  console.log("PASS: simultaneous same stable voice mutation ID deducts once");

  await seed("bob", "private", 5, "pcs", 0);
  await assert.rejects(
    persistVerifiedVoiceConsumption(bob, {
      userId: "alice",
      mutationId: "voice-cross",
      purpose: "food-use",
      expectedStock: [expectation("private", 5, "pcs", 0)],
      deductions: [deduction("eggs", "private", 1, "pcs")],
    }),
    error => error?.code === "permission-denied",
  );
  await assert.rejects(
    persistVerifiedVoiceConsumption(guest, {
      userId: "alice",
      mutationId: "voice-guest",
      purpose: "food-use",
      expectedStock: [expectation("private", 5, "pcs", 0)],
      deductions: [deduction("eggs", "private", 1, "pcs")],
    }),
    error => error?.code === "permission-denied",
  );
  assert.equal((await stock(bob, "bob", "private")).quantity, 5);
  console.log("PASS: voice consumption journal and stock remain owner-only");

  const purchasedId = "purchase-shopping:s2";
  await seed("alice", purchasedId, 1, "L", 0);
  const purchasedVoice = await persistVerifiedVoiceConsumption(
    alice,
    request(
      "voice-purchased-lot",
      [expectation(purchasedId, 1, "L", 0)],
      [deduction("milk", purchasedId, 0.25, "L")],
    ),
  );
  assert.equal(purchasedVoice.outcome, "recorded");
  assert.equal((await stock(alice, "alice", purchasedId)).quantity, 0.75);
  assert.equal((await stock(alice, "alice", purchasedId)).cookRevision, 1);
  console.log("PASS: voice consumes purchase-provenance logical pantry ID");
} finally {
  await environment.cleanup();
}
