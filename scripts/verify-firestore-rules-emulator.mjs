import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const projectId = "demo-balkanbite-integration";
const rules = fs.readFileSync("firestore.rules", "utf8");
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules,
    host: "127.0.0.1",
    port: 8080,
  },
});

const uidA = "qa-user-a";
const uidB = "qa-user-b";
const dbA = testEnv.authenticatedContext(uidA, { email: "qa-a@example.invalid" }).firestore();
const dbB = testEnv.authenticatedContext(uidB, { email: "qa-b@example.invalid" }).firestore();
const dbGuest = testEnv.unauthenticatedContext().firestore();

try {
  const scopedA = `u_${encodeURIComponent(uidA)}__item-1`;
  const legacyA = "legacy-item-a";

  await assertFails(getDoc(doc(dbGuest, "inventory", scopedA)));
  await assertFails(setDoc(doc(dbGuest, "inventory", "guest-item"), {
    id: "guest-item",
    userId: uidA,
    name: "Guest must not write",
    quantity: 1,
    unit: "uds",
  }));

  await assertSucceeds(setDoc(doc(dbA, "users", uidA), {
    userId: uidA,
    language: "es",
  }));
  await assertSucceeds(getDoc(doc(dbA, "users", uidA)));
  await assertFails(getDoc(doc(dbB, "users", uidA)));

  await assertSucceeds(setDoc(doc(dbA, "inventory", scopedA), {
    id: "item-1",
    userId: uidA,
    name: "QA Tomato",
    quantity: 2,
    unit: "uds",
    _deleted: false,
    deletedAt: null,
  }));
  assert.equal((await assertSucceeds(getDoc(doc(dbA, "inventory", scopedA)))).exists(), true);
  await assertFails(getDoc(doc(dbB, "inventory", scopedA)));
  await assertFails(setDoc(doc(dbB, "inventory", scopedA), {
    id: "item-1",
    userId: uidA,
    name: "Cross-user overwrite",
    quantity: 99,
    unit: "uds",
  }));
  await assertFails(setDoc(doc(dbA, "inventory", scopedA), {
    userId: uidB,
  }, { merge: true }));

  const ownInventoryQuery = query(collection(dbA, "inventory"), where("userId", "==", uidA));
  assert.equal((await assertSucceeds(getDocs(ownInventoryQuery))).size, 1);
  const crossInventoryQuery = query(collection(dbB, "inventory"), where("userId", "==", uidA));
  await assertFails(getDocs(crossInventoryQuery));

  await assertSucceeds(setDoc(doc(dbA, "inventory", legacyA), {
    id: legacyA,
    userId: uidA,
    name: "Legacy QA",
    quantity: 1,
    unit: "uds",
  }));
  assert.equal((await assertSucceeds(getDoc(doc(dbA, "inventory", legacyA)))).exists(), true);

  await assertSucceeds(setDoc(doc(dbA, "inventory", scopedA), {
    id: "item-1",
    userId: uidA,
    _deleted: true,
    deletedAt: new Date().toISOString(),
  }, { merge: true }));
  const tombstone = (await assertSucceeds(getDoc(doc(dbA, "inventory", scopedA)))).data();
  assert.equal(tombstone._deleted, true);

  await assertSucceeds(setDoc(doc(dbA, "inventory", scopedA), {
    id: "item-1",
    userId: uidA,
    name: "QA Tomato",
    quantity: 3,
    unit: "uds",
    _deleted: false,
    deletedAt: null,
  }, { merge: true }));
  const reactivated = (await assertSucceeds(getDoc(doc(dbA, "inventory", scopedA)))).data();
  assert.equal(reactivated._deleted, false);
  assert.equal(reactivated.quantity, 3);

  for (const collectionName of ["recipes", "mealPlans", "shoppingList"]) {
    const ownRef = doc(dbA, collectionName, `qa-${collectionName}`);
    await assertSucceeds(setDoc(ownRef, { id: `qa-${collectionName}`, userId: uidA, value: 1 }));
    assert.equal((await assertSucceeds(getDoc(ownRef))).exists(), true);
    await assertFails(getDoc(doc(dbB, collectionName, `qa-${collectionName}`)));
    await assertFails(setDoc(ownRef, { userId: uidB }, { merge: true }));
  }

  console.log("Firestore ownership/rules emulator QA: PASS");
} finally {
  await testEnv.cleanup();
}
