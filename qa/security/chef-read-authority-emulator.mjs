import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDocs, query, where, onSnapshot, setDoc,
  deleteDoc, disableNetwork, enableNetwork,
} from "firebase/firestore";
import { getScopedDocumentId } from "../../src/utils/cloudCollectionSync.ts";
import {
  deriveChefServerPantryRead, deriveChefServerCollectionRead,
  deriveChefServerProgressRead, selectCompleteChefServerPantry,
  selectCompleteChefServerWorkspace,
} from "../../src/utils/chefServerReadAuthority.ts";
import { subscribeProgressionEvents } from "../../src/utils/progressionFirestore.ts";

// LOCAL EMULATOR ONLY. No credentials, real UIDs, Google Identity API or
// hosted Firestore writes are allowed by this test.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST,
  "Refusing real Firestore: FIRESTORE_EMULATOR_HOST is required");
const [host, portString] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const environment = await initializeTestEnvironment({
  projectId: "demo-balkanbite-chef-read",
  firestore: {
    host, port: Number(portString),
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});
const owner = "chef_emulator_owner";
const stranger = "chef_emulator_other";
const db = environment.authenticatedContext(owner).firestore();
const otherDb = environment.authenticatedContext(stranger).firestore();
const inventoryId = getScopedDocumentId(owner, "rice");
const mealId = getScopedDocumentId(owner, "2026-10-17");
const shoppingId = getScopedDocumentId(owner, "salt");
const pantry = {
  id: "rice", name: "QA Rice", quantity: 500, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-17", cookRevision: 0,
};
const plan = { date: "2026-10-17" };
const shopping = {
  id: "salt", name: "QA Salt", quantity: 1, unit: "kg",
  category: "Other", checked: false, amountOrigin: "user_entered",
};
const progress = {
  version: 1, eventId: "purchase:qa",
  type: "confirmed_purchase_applied", occurredAt: "2026-10-17T10:00:00.000Z",
  evidence: "deterministic_state_transition", evidenceCount: 1,
};
const paths = [
  ["inventory", inventoryId, pantry],
  ["mealPlans", mealId, plan],
  ["shoppingList", shoppingId, shopping],
];
const waitFor = async (predicate, description, timeoutMs = 12000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error("Timed out awaiting " + description);
};
const unsubs = [];
const errors = [];
const seen = { inventory: null, mealPlans: null, shoppingList: null, progression: null };
const displayed = { inventory: [], mealPlans: [], shoppingList: [], progression: [] };
const latestMeta = {};
const readPantry = () => selectCompleteChefServerPantry(
  owner, owner, seen.inventory ?? undefined, displayed.inventory,
);
const readWorkspace = () => selectCompleteChefServerWorkspace(
  owner, owner, {
    mealPlans: seen.mealPlans ?? undefined,
    shoppingList: seen.shoppingList ?? undefined,
    progression: seen.progression ?? undefined,
  }, { mealPlan: displayed.mealPlans,
       shopping: displayed.shoppingList, progression: displayed.progression },
);

try {
  await environment.withSecurityRulesDisabled(async context => {
    const admin = context.firestore();
    for (const [group, id, item] of paths) {
      await setDoc(doc(admin, group, id), { userId: owner, ...item });
    }
    await setDoc(doc(admin, "users", owner, "progressionEvents", progress.eventId),
      { ...progress, userId: owner, requestSignature: "qa" });
  });

  // Observe the actual authenticated Firestore SDK, not hand-made metadata.
  for (const name of ["inventory", "mealPlans", "shoppingList"]) {
    const q = query(collection(db, name), where("userId", "==", owner));
    unsubs.push(onSnapshot(q, { includeMetadataChanges: true }, snap => {
      latestMeta[name] = {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      };
      const docs = snap.docs.map(row => ({
        documentId: row.id, data: row.data(),
        hasPendingWrites: row.metadata.hasPendingWrites,
      }));
      seen[name] = name === "inventory"
        ? deriveChefServerPantryRead(owner, snap.metadata, docs)
        : deriveChefServerCollectionRead(name, owner, snap.metadata, docs);
      // Model the same flattened visible payload shape as useFirebaseSync.
      if (name === "inventory") {
        displayed[name] = docs.filter(row => row.data._deleted !== true)
          .map(row => {
            const { userId: _owner, _deleted: _deleted, deletedAt: _deletedAt,
              ...item } = row.data;
            return item;
          });
      } else {
        displayed[name] = docs.map(row => {
          const { userId: _owner, ...item } = row.data;
          return item;
        });
      }
    }, error => errors.push(name + ": " + error.message)));
  }
  unsubs.push(subscribeProgressionEvents(db, owner, events => {
    displayed.progression = events;
  }, error => errors.push("progression: " + error.message), evidence => {
    seen.progression = evidence;
  }));

  await waitFor(() => readPantry() !== null && readWorkspace() !== null,
    "owner's four independent confirmed server snapshots");
  assert.deepEqual(readPantry(), [pantry]);
  assert.deepEqual(readWorkspace(), {
    mealPlan: [plan], shopping: [shopping], progression: [progress],
  });
  assert.deepEqual(errors, [], "owner listeners must be allowed by real rules");
  for (const key of ["inventory", "mealPlans", "shoppingList"]) {
    assert.equal(latestMeta[key].fromCache, false);
    assert.equal(latestMeta[key].hasPendingWrites, false);
  }

  // The same valid server evidence is NEVER proof of an old React render.
  const stalePantry = [{ ...pantry, quantity: 550 }];
  assert.equal(selectCompleteChefServerPantry(
    owner, owner, seen.inventory, stalePantry), null);
  assert.equal(selectCompleteChefServerWorkspace(owner, owner, {
    mealPlans: seen.mealPlans, shoppingList: seen.shoppingList,
    progression: seen.progression,
  }, { mealPlan: [plan], shopping: [], progression: [progress] }), null);
  assert.equal(selectCompleteChefServerPantry(
    stranger, stranger, seen.inventory, [pantry]), null);
  assert.equal(selectCompleteChefServerWorkspace(stranger, stranger, {
    mealPlans: seen.mealPlans, shoppingList: seen.shoppingList,
    progression: seen.progression,
  }, { mealPlan: [plan], shopping: [shopping], progression: [progress] }), null);
  await assertFails(getDocs(query(collection(otherDb, "inventory"),
    where("userId", "==", owner))), "foreign user's owner-filtered inventory query must be denied");

  // An invalid server row cannot disappear silently into a partial Chef claim.
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "shoppingList",
      getScopedDocumentId(owner, "corrupt")),
    { userId: owner, id: "corrupt", name: "Corrupt", checked: false });
  });
  await waitFor(() => displayed.shoppingList.length === 2,
    "invalid server row delivered to owner listener");
  assert.equal(seen.shoppingList, null);
  assert.equal(readWorkspace(), null);
  await environment.withSecurityRulesDisabled(async context => {
    await deleteDoc(doc(context.firestore(), "shoppingList",
      getScopedDocumentId(owner, "corrupt")));
  });
  await waitFor(() => displayed.shoppingList.length === 1 &&
    readWorkspace() !== null, "valid shopping authority recovered after server removal");

  // Network loss/cache metadata must revoke authority even if cached rows
  // are still rendered. Real Firestore event delivery is exercised here.
  await disableNetwork(db);
  await waitFor(() => latestMeta.inventory?.fromCache === true &&
    latestMeta.mealPlans?.fromCache === true &&
    latestMeta.shoppingList?.fromCache === true,
    "offline metadata transition for three listeners");
  assert.equal(readPantry(), null, "cache-only inventory is not confirmed");
  assert.equal(readWorkspace(), null, "cached menu/shopping/progress not confirmed");
  await enableNetwork(db);
  await waitFor(() => readPantry() !== null && readWorkspace() !== null,
    "restored remote confirmation after network return");
  assert.deepEqual(errors, []);
  console.log("PASS Chef signed-in Firestore emulator: owner/foreign isolation, all four server echoes, stale UI, malformed row, offline revocation and recovery");
} finally {
  for (const unsubscribe of unsubs) unsubscribe();
  await environment.cleanup();
}
