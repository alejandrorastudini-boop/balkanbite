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
  const canonicalProfile = {
    name: "QA",
    language: "en",
    currency: "EUR",
    cookingSpeed: null,
    healthGoal: null,
    dietStyle: null,
    disliked: [],
    allergies: null,
    householdSize: null,
    cookingLevel: null,
    appliances: null,
    monthlyBudgetEUR: null,
    healthProfile: null,
    heightCm: null,
    weightKg: null,
    budgetTier: null,
    isProSubscriber: null,
    onboardingCompleted: false,
    userId: "alice",
    profileRevision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(aliceProfile, canonicalProfile));
  await assertSucceeds(updateDoc(aliceProfile, {
    name: "QA2",
    profileRevision: 1,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(aliceProfile, { name: "stale", profileRevision: 1 }));
  await assertFails(updateDoc(aliceProfile, { userId: "bob", profileRevision: 2 }));
  await assertFails(updateDoc(aliceProfile, {
    profileRevision: 2,
    dietStyle: "invented-diet",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(aliceProfile, {
    profileRevision: 2,
    monthlyBudgetEUR: -1,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(aliceProfile, {
    profileRevision: 2,
    heightCm: 180,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(aliceProfile, {
    profileRevision: 2,
    healthProfile: {
      version: 1,
      ageYears: { status: "known", value: -5, source: "self_reported", recordedAt: null },
      heightCm: null,
      weightKg: null,
      physiologicalSex: null,
      activityCategory: null,
      pregnancyLactationStatus: null,
    },
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(aliceProfile, {
    profileRevision: 2,
    healthProfile: {
      version: 1,
      ageYears: { status: "known", value: 35, source: "self_reported", recordedAt: null },
      heightCm: null,
      weightKg: null,
      physiologicalSex: null,
      activityCategory: null,
      pregnancyLactationStatus: null,
    },
    updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(aliceProfile));
  await assertSucceeds(getDoc(aliceProfile));
  await assertFails(getDoc(doc(bob, "users", "alice")));
  await assertFails(getDoc(doc(stranger, "users", "alice")));
  await assertFails(setDoc(doc(bob, "users", "alice"), { ...canonicalProfile, userId: "bob" }));
  await assertFails(setDoc(doc(bob, "users", "bob"), { userId: "bob" }));

  const recipeAuthority = doc(alice, "derivedCollectionAuthorities", "u_alice__recipes");
  await assertSucceeds(setDoc(recipeAuthority, {
    userId: "alice",
    collectionName: "recipes",
    revision: 0,
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(recipeAuthority));
  await assertFails(getDoc(doc(bob, "derivedCollectionAuthorities", "u_alice__recipes")));
  await assertSucceeds(updateDoc(recipeAuthority, {
    revision: 1,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(recipeAuthority, {
    revision: 3,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(recipeAuthority, {
    collectionName: "mealPlans",
    revision: 2,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(recipeAuthority));
  await assertFails(setDoc(doc(alice, "derivedCollectionAuthorities", "u_alice__wrong"), {
    userId: "alice",
    collectionName: "recipes",
    revision: 0,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(bob, "derivedCollectionAuthorities", "u_alice__mealPlans"), {
    userId: "bob",
    collectionName: "mealPlans",
    revision: 0,
    updatedAt: serverTimestamp(),
  }));

  const progressionRef = doc(alice, "users", "alice", "progressionEvents", "cook:action-1");
  const progressionEvent = {
    version: 1,
    eventId: "cook:action-1",
    type: "recipe_cook_inventory_applied",
    occurredAt: "2026-10-03T12:00:00.000Z",
    evidence: "deterministic_state_transition",
    evidenceCount: 2,
    userId: "alice",
    requestSignature: "cook-action-1",
    createdAt: new Date(),
  };
  await assertSucceeds(setDoc(progressionRef, progressionEvent));
  await assertSucceeds(getDoc(progressionRef));
  await assertFails(getDoc(doc(bob, "users", "alice", "progressionEvents", "cook:action-1")));
  await assertFails(updateDoc(progressionRef, { evidenceCount: 3 }));
  await assertFails(deleteDoc(progressionRef));
  await assertFails(setDoc(doc(alice, "users", "alice", "progressionEvents", "bad"), {
    ...progressionEvent,
    eventId: "bad",
    evidenceCount: 0,
  }));
  await assertFails(setDoc(doc(alice, "users", "alice", "progressionEvents", "extra-field"), {
    ...progressionEvent,
    eventId: "extra-field",
    unexpectedField: "not-canonical",
  }));
  const progressionWithoutOccurredAt = { ...progressionEvent };
  delete progressionWithoutOccurredAt.occurredAt;
  await assertFails(setDoc(doc(alice, "users", "alice", "progressionEvents", "missing-time"), {
    ...progressionWithoutOccurredAt,
    eventId: "missing-time",
  }));
  await assertFails(setDoc(doc(bob, "users", "alice", "progressionEvents", "bob-attack"), {
    ...progressionEvent,
    eventId: "bob-attack",
    userId: "bob",
  }));

  const mealRef = doc(alice, "users", "alice", "mealLogs", "meal-1");
  const verifiedMeal = {
    id: "meal-1",
    userId: "alice",
    date: "2026-10-03",
    mealType: "lunch",
    nutritionDataStatus: "verified",
    calories: 500,
    proteinG: 30,
    carbsG: 50,
    fatG: 20,
    timestamp: "2026-10-03T12:00:00.000Z",
    requestSignature: "verified-meal",
    createdAt: new Date(),
  };
  await assertSucceeds(setDoc(mealRef, verifiedMeal));
  await assertSucceeds(getDoc(mealRef));
  await assertFails(getDoc(doc(bob, "users", "alice", "mealLogs", "meal-1")));
  await assertFails(updateDoc(mealRef, { calories: 600 }));
  await assertFails(deleteDoc(mealRef));
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "bad-unverified"), {
    ...verifiedMeal,
    id: "bad-unverified",
    nutritionDataStatus: "unknown",
  }));
  await assertSucceeds(setDoc(doc(alice, "users", "alice", "mealLogs", "unknown-meal"), {
    id: "unknown-meal",
    userId: "alice",
    date: "2026-10-03",
    mealType: "snack",
    nutritionDataStatus: "unknown",
    timestamp: "2026-10-03T15:00:00.000Z",
    requestSignature: "unknown-meal",
    createdAt: new Date(),
  }));
  const mealWithoutType = { ...verifiedMeal };
  delete mealWithoutType.mealType;
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "missing-type"), {
    ...mealWithoutType,
    id: "missing-type",
  }));
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "bad-type"), {
    ...verifiedMeal,
    id: "bad-type",
    mealType: "brunch",
  }));
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "bad-date"), {
    ...verifiedMeal,
    id: "bad-date",
    date: "2026-1-3",
  }));
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "empty-name"), {
    ...verifiedMeal,
    id: "empty-name",
    manualName: "",
  }));
  await assertFails(setDoc(doc(alice, "users", "alice", "mealLogs", "extra-field"), {
    ...verifiedMeal,
    id: "extra-field",
    unexpectedField: "not-canonical",
  }));
  await assertFails(setDoc(doc(bob, "users", "alice", "mealLogs", "bob-attack"), {
    ...verifiedMeal,
    id: "bob-attack",
    userId: "bob",
  }));

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
