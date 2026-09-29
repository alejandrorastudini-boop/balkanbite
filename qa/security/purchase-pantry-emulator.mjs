import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  persistPurchasesIntoPantryAtomically,
} from "../../src/utils/purchasePantryFirestore.ts";
import { getScopedDocumentId } from "../../src/utils/cloudCollectionSync.ts";

const [host, portText] =
  (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-purchase-pantry",
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

const invRef = (db, uid, id) =>
  doc(db, "inventory", getScopedDocumentId(uid, id));
const journalRef = (db, uid, id) =>
  doc(db, "purchaseApplications", getScopedDocumentId(uid, id));
const shoppingRef = (db, uid, id) =>
  doc(db, "shoppingList", getScopedDocumentId(uid, id));

const pantryItem = (
  id,
  name,
  quantity,
  unit,
  cookRevision = 0,
  overrides = {},
) => ({
  id,
  name,
  quantity,
  unit,
  category: "Produce",
  addedAt: "2026-09-29",
  cookRevision,
  ...overrides,
});

const shoppingItem = (
  id,
  name,
  quantity,
  unit,
  overrides = {},
) => ({
  id,
  name,
  quantity,
  unit,
  category: "Produce",
  checked: true,
  purchaseAmountConfirmed: true,
  amountOrigin: "user_entered",
  ...overrides,
});

async function seed(uid, item) {
  await environment.withSecurityRulesDisabled(async context => {
    const { cookRevision = 0, ...rest } = item;
    await setDoc(invRef(context.firestore(), uid, item.id), {
      ...rest,
      userId: uid,
      cookRevision,
      _deleted: false,
      deletedAt: null,
    });
  });
}

async function seedShopping(uid, item) {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(shoppingRef(context.firestore(), uid, item.id), {
      ...item,
      userId: uid,
    });
  });
}

async function readStock(db, uid, id) {
  const snap = await getDoc(invRef(db, uid, id));
  return snap.exists() ? snap.data() : null;
}

try {
  const tomato = pantryItem("tomato", "Tomate", 1, "kg", 2);
  const unrelated = pantryItem("salt", "Sal", 500, "g", 7);
  await seed("alice", tomato);
  await seed("alice", unrelated);
  const s1 = shoppingItem("s1", "Tomate", 0.5, "kg");
  const s2 = shoppingItem("s2", "Leche", 1, "L", { category: "Dairy" });
  const untouchedShopping = shoppingItem("keep", "Pan", 1, "pcs");
  await seedShopping("alice", s1);
  await seedShopping("alice", s2);
  await seedShopping("alice", untouchedShopping);

  const purchases = [
    {
      sourceId: "shopping:s1",
      source: "shopping_list",
      name: "Tomate",
      quantity: 0.5,
      unit: "kg",
      category: "Produce",
    },
    {
      sourceId: "shopping:s2",
      source: "shopping_list",
      name: "Leche",
      quantity: 1,
      unit: "L",
      category: "Dairy",
    },
  ];

  const request = {
    userId: "alice",
    mutationId: "purchase-apply-1",
    baselinePantry: [tomato, unrelated],
    purchases,
    shoppingItemsToRemove: [s1, s2],
    acquiredAt: "2026-09-29",
  };

  const first = await persistPurchasesIntoPantryAtomically(alice, request);
  assert.equal(first.outcome, "recorded");
  assert.deepEqual(first.acceptedSourceIds, ["shopping:s1", "shopping:s2"]);
  assert.deepEqual(first.newlyAppliedSourceIds, ["shopping:s1", "shopping:s2"]);
  assert.equal(first.expectedChanges.length, 2);
  assert.deepEqual(first.removedShoppingItemIds, ["s1", "s2"]);

  const tomatoAfter = await readStock(alice, "alice", "tomato");
  assert.equal(tomatoAfter.quantity, 1.5);
  assert.equal(tomatoAfter.cookRevision, 3);
  assert.equal(tomatoAfter.purchaseHistory.length, 2);
  assert.equal(tomatoAfter.purchaseHistory[0].sourceId, "legacy:tomato");
  assert.equal(tomatoAfter.purchaseHistory[1].sourceId, "shopping:s1");

  const milkAfter = await readStock(alice, "alice", "purchase-shopping:s2");
  assert.equal(milkAfter.quantity, 1);
  assert.equal(milkAfter.unit, "L");
  assert.equal(milkAfter.cookRevision, 0);
  assert.equal(milkAfter.purchaseHistory[0].sourceId, "shopping:s2");

  const unrelatedAfter = await readStock(alice, "alice", "salt");
  assert.equal(unrelatedAfter.quantity, 500);
  assert.equal(unrelatedAfter.cookRevision, 7);
  assert.equal(unrelatedAfter.purchaseHistory, undefined);
  assert.equal((await getDoc(shoppingRef(alice, "alice", "s1"))).exists(), false);
  assert.equal((await getDoc(shoppingRef(alice, "alice", "s2"))).exists(), false);
  assert.equal((await getDoc(shoppingRef(alice, "alice", "keep"))).exists(), true);
  await assert.rejects(
    getDoc(shoppingRef(bob, "alice", "s1")),
    error => error?.code === "permission-denied",
  );
  await assert.rejects(
    getDoc(shoppingRef(guest, "alice", "s1")),
    error => error?.code === "permission-denied",
  );
  console.log("PASS: purchase atomically applies stock and removes only accepted shopping rows");

  const replay = await persistPurchasesIntoPantryAtomically(
    aliceOtherDevice,
    request,
  );
  assert.equal(replay.outcome, "already-recorded");
  assert.equal((await readStock(alice, "alice", "tomato")).quantity, 1.5);
  assert.equal((await readStock(alice, "alice", "tomato")).cookRevision, 3);
  assert.equal(
    (await readStock(alice, "alice", "purchase-shopping:s2")).quantity,
    1,
  );
  console.log("PASS: exact purchase replay cannot double-add stock");
  assert.deepEqual(replay.removedShoppingItemIds, ["s1", "s2"]);

  const changedReplay = await persistPurchasesIntoPantryAtomically(alice, {
    ...request,
    purchases: [
      { ...purchases[0], quantity: 0.75 },
      purchases[1],
    ],
  });
  assert.deepEqual(changedReplay, {
    outcome: "needs-review",
    reason: "conflicting-replay",
  });
  assert.equal((await readStock(alice, "alice", "tomato")).quantity, 1.5);

  const staleBase = pantryItem("stale", "Arroz", 1, "kg", 1);
  await seed("alice", pantryItem("stale", "Arroz", 0.9, "kg", 2));
  const stale = await persistPurchasesIntoPantryAtomically(alice, {
    userId: "alice",
    mutationId: "purchase-stale",
    baselinePantry: [staleBase],
    purchases: [{
      sourceId: "shopping:stale",
      source: "shopping_list",
      name: "Arroz",
      quantity: 0.25,
      unit: "kg",
      category: "Pantry/Grains",
    }],
    acquiredAt: "2026-09-29",
  });
  assert.deepEqual(stale, {
    outcome: "needs-review",
    reason: "stale-stock",
    pantryItemId: "stale",
  });
  assert.equal((await readStock(alice, "alice", "stale")).quantity, 0.9);
  assert.equal(
    (await getDoc(journalRef(alice, "alice", "purchase-stale"))).exists(),
    false,
  );
  console.log("PASS: stale purchase baseline fails with zero journal/write");


  const shoppingStaleStock = pantryItem("shopping-stale-stock", "Боб", 1, "kg", 0);
  const reviewedShopping = shoppingItem("shopping-stale", "Боб", 0.5, "kg");
  await seed("alice", shoppingStaleStock);
  await seedShopping("alice", reviewedShopping);
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(shoppingRef(context.firestore(), "alice", "shopping-stale"), {
      ...reviewedShopping,
      quantity: 0.75,
      userId: "alice",
    });
  });
  const staleShopping = await persistPurchasesIntoPantryAtomically(alice, {
    userId: "alice",
    mutationId: "purchase-shopping-stale",
    baselinePantry: [shoppingStaleStock],
    purchases: [{
      sourceId: "shopping:shopping-stale",
      source: "shopping_list",
      name: "Боб",
      quantity: 0.5,
      unit: "kg",
      category: "Pantry/Grains",
    }],
    shoppingItemsToRemove: [reviewedShopping],
    acquiredAt: "2026-09-29",
  });
  assert.deepEqual(staleShopping, {
    outcome: "needs-review",
    reason: "stale-shopping",
    shoppingItemId: "shopping-stale",
  });
  assert.equal((await readStock(alice, "alice", "shopping-stale-stock")).quantity, 1);
  assert.equal(
    (await getDoc(shoppingRef(alice, "alice", "shopping-stale"))).data().quantity,
    0.75,
  );
  assert.equal(
    (await getDoc(journalRef(alice, "alice", "purchase-shopping-stale"))).exists(),
    false,
  );
  console.log("PASS: changed reviewed shopping row aborts stock + list atomically");

  const raceBase = pantryItem("race-stock", "Pasta", 1, "kg", 0);
  await seed("alice", raceBase);
  const racePurchase = [{
    sourceId: "shopping:race",
    source: "shopping_list",
    name: "Pasta",
    quantity: 0.5,
    unit: "kg",
    category: "Pantry/Grains",
  }];
  const race = await Promise.all([
    persistPurchasesIntoPantryAtomically(alice, {
      userId: "alice",
      mutationId: "purchase-race-a",
      baselinePantry: [raceBase],
      purchases: racePurchase,
      acquiredAt: "2026-09-29",
    }),
    persistPurchasesIntoPantryAtomically(aliceOtherDevice, {
      userId: "alice",
      mutationId: "purchase-race-b",
      baselinePantry: [raceBase],
      purchases: racePurchase,
      acquiredAt: "2026-09-29",
    }),
  ]);
  assert.equal(race.filter(result => result.outcome === "recorded").length, 1);
  assert.equal(
    race.filter(result =>
      result.outcome === "needs-review" &&
      result.reason === "stale-stock").length,
    1,
  );
  assert.equal((await readStock(alice, "alice", "race-stock")).quantity, 1.5);
  assert.equal((await readStock(alice, "alice", "race-stock")).cookRevision, 1);
  const raceJournalCount =
    Number((await getDoc(journalRef(alice, "alice", "purchase-race-a"))).exists()) +
    Number((await getDoc(journalRef(alice, "alice", "purchase-race-b"))).exists());
  assert.equal(raceJournalCount, 1);
  console.log("PASS: concurrent purchase applications cannot double-add the same baseline");

  await seed("bob", pantryItem("private", "Яйца", 6, "pcs", 0));
  await assert.rejects(
    persistPurchasesIntoPantryAtomically(bob, {
      userId: "alice",
      mutationId: "purchase-cross",
      baselinePantry: [pantryItem("private", "Яйца", 6, "pcs", 0)],
      purchases: [{
        sourceId: "shopping:bob",
        source: "shopping_list",
        name: "Яйца",
        quantity: 2,
        unit: "pcs",
        category: "Dairy",
      }],
      acquiredAt: "2026-09-29",
    }),
    error => error?.code === "permission-denied",
  );
  await assert.rejects(
    persistPurchasesIntoPantryAtomically(guest, {
      userId: "alice",
      mutationId: "purchase-guest",
      baselinePantry: [pantryItem("private", "Яйца", 6, "pcs", 0)],
      purchases: [{
        sourceId: "shopping:guest",
        source: "shopping_list",
        name: "Яйца",
        quantity: 1,
        unit: "pcs",
        category: "Dairy",
      }],
      acquiredAt: "2026-09-29",
    }),
    error => error?.code === "permission-denied",
  );
  assert.equal((await readStock(bob, "bob", "private")).quantity, 6);
  console.log("PASS: purchase application remains owner-only");
} finally {
  await environment.cleanup();
}
