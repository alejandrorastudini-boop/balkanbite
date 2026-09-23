import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where,
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

  // Create-only cook journal: owner-bound ID, immutable record, fail-closed reads.
  const journal = collection(alice, "cookConfirmations");
  const aliceCook = doc(journal, "u_alice__cook-qa-1");
  const validCook = {
    userId: "alice",
    cookConfirmationId: "cook-qa-1",
    mealId: "meal-qa-1",
    requestSignature: "canonical-request-v1",
    deductions: [{ pantryItemId: "rice", quantity: 100, unit: "g" }],
    createdAt: serverTimestamp(),
  };
  const absentOwnerJournal = doc(alice, "cookConfirmations", "u_alice__not-created");
  const missing = await assertSucceeds(getDoc(absentOwnerJournal));
  assert.equal(missing.exists(), false);
  await assertFails(getDoc(doc(bob, "cookConfirmations", "u_alice__not-created")));
  await assertFails(getDoc(doc(stranger, "cookConfirmations", "u_alice__not-created")));
  await assertFails(getDoc(doc(alice, "cookConfirmations", "u_bob__not-created")));

  await assertSucceeds(setDoc(aliceCook, validCook));
  await assertSucceeds(getDoc(aliceCook));
  await assertFails(getDoc(doc(bob, "cookConfirmations", "u_alice__cook-qa-1")));
  await assertFails(getDoc(doc(stranger, "cookConfirmations", "u_alice__cook-qa-1")));
  await assertFails(updateDoc(aliceCook, { mealId: "another-meal" }));
  await assertFails(deleteDoc(aliceCook));
  await assertFails(setDoc(aliceCook, validCook)); // immutable even for same owner

  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_bob__foreign"), validCook,
  ));
  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_alice__wrong-id"), validCook,
  ));
  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_alice__bad-owner"),
    { ...validCook, userId: "bob", cookConfirmationId: "bad-owner" },
  ));
  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_alice__missing-signature"),
    { ...validCook, cookConfirmationId: "missing-signature", requestSignature: "" },
  ));
  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_alice__empty-deductions"),
    { ...validCook, cookConfirmationId: "empty-deductions", deductions: [] },
  ));
  await assertFails(setDoc(
    doc(alice, "cookConfirmations", "u_alice__extra-field"),
    { ...validCook, cookConfirmationId: "extra-field", verified: true },
  ));
  await assertFails(setDoc(
    doc(bob, "cookConfirmations", "u_alice__bob-attack"),
    { ...validCook, userId: "bob", cookConfirmationId: "bob-attack" },
  ));
  const aliceJournal = await assertSucceeds(getDocs(query(
    collection(alice, "cookConfirmations"), where("userId", "==", "alice"),
  )));
  assert.equal(aliceJournal.size, 1);
  await assertFails(getDocs(query(
    collection(bob, "cookConfirmations"), where("userId", "==", "alice"),
  )));

  console.log("PASS: named release rules: 4 owner collections and immutable cook journal, UID namespace, owner queries.");
} finally {
  await environment.cleanup();
}
