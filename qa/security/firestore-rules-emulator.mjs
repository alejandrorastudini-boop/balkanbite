import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = emulatorHost.split(":");
const projectId = "demo-balkanbite-rules";
const environment = await initializeTestEnvironment({
  projectId,
  firestore: {
    host,
    port: Number(portText),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

const alice = environment.authenticatedContext("alice").firestore();
const bob = environment.authenticatedContext("bob").firestore();
const stranger = environment.unauthenticatedContext().firestore();

try {
  const aliceProfile = doc(alice, "users", "alice");
  await assertSucceeds(setDoc(aliceProfile, { userId: "alice", nickname: "QA" }));
  await assertSucceeds(getDoc(aliceProfile));
  await assertFails(getDoc(doc(bob, "users", "alice")));
  await assertFails(getDoc(doc(stranger, "users", "alice")));
  await assertFails(setDoc(doc(bob, "users", "alice"), { userId: "bob" }));

  for (const collectionName of ["inventory", "recipes", "mealPlans", "shoppingList"]) {
    const logicalId = collectionName === "mealPlans" ? "2099-12-31" : "shared";
    const aliceId = "u_alice__" + logicalId;
    const bobId = "u_bob__" + logicalId;
    const aliceRef = doc(alice, collectionName, aliceId);
    const bobRef = doc(bob, collectionName, bobId);
    const itemField = collectionName === "mealPlans"
      ? { date: logicalId }
      : { id: logicalId };

    await assertSucceeds(setDoc(aliceRef, { ...itemField, userId: "alice" }));
    await assertSucceeds(setDoc(bobRef, { ...itemField, userId: "bob" }));
    await assertSucceeds(getDoc(aliceRef));
    await assertSucceeds(getDoc(bobRef));

    await assertFails(getDoc(doc(bob, collectionName, aliceId)));
    await assertFails(getDoc(doc(alice, collectionName, bobId)));
    await assertFails(getDoc(doc(stranger, collectionName, aliceId)));

    await assertFails(updateDoc(doc(bob, collectionName, aliceId), { id: "attack" }));
    await assertFails(updateDoc(aliceRef, { userId: "bob" }));

    await assertFails(setDoc(
      doc(alice, collectionName, "u_bob__reserved"),
      { ...itemField, userId: "alice" },
    ));
    await assertFails(setDoc(
      doc(bob, collectionName, "u_alice__reserved"),
      { ...itemField, userId: "bob" },
    ));
    await assertFails(setDoc(
      doc(bob, collectionName, "unscoped-global-id"),
      { ...itemField, userId: "bob" },
    ));
    await assertFails(setDoc(
      doc(alice, collectionName, "u_alice__wrong-owner"),
      { ...itemField, userId: "bob" },
    ));

    const ownedQuery = query(
      collection(alice, collectionName),
      where("userId", "==", "alice"),
    );
    const ownedResults = await assertSucceeds(getDocs(ownedQuery));
    assert.equal(ownedResults.size, 1, collectionName + " owner query unexpected count");
    await assertFails(getDocs(query(
      collection(bob, collectionName),
      where("userId", "==", "alice"),
    )));
  }

  console.log("PASS: named release rules: profile boundary, all 4 owner collections, UID namespace, owner-filtered queries.");
} finally {
  await environment.cleanup();
}
