import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { clearShoppingItems, createShoppingItem, createShoppingItems, removeShoppingItem, replaceShoppingItem } from "../../src/utils/shoppingMutationFirestore.ts";
import { reconcileDerivedShortagesAtomically } from "../../src/utils/derivedShortageShoppingFirestore.ts";

const projectId = "demo-balkanbite-rules";
const rules = readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });

const aliceDb = env.authenticatedContext("alice").firestore();
const bobDb = env.authenticatedContext("bob").firestore();

const base = {
  id: "shop-rice",
  name: "Rice",
  quantity: 1,
  unit: "kg",
  category: "grains",
  checked: false,
  amountOrigin: "user_entered",
  purchaseAmountConfirmed: false,
};

try {
  const created = await createShoppingItem(aliceDb, "alice", base);
  assert.deepEqual(created, { outcome: "applied" });

  const duplicate = await createShoppingItem(aliceDb, "alice", base);
  assert.deepEqual(duplicate, { outcome: "needs-review", reason: "stale-item" });

  const checked = { ...base, checked: true, purchaseAmountConfirmed: true };
  const toggled = await replaceShoppingItem(aliceDb, "alice", base, checked);
  assert.deepEqual(toggled, { outcome: "applied" });

  const staleToggle = await replaceShoppingItem(aliceDb, "alice", base, {
    ...base,
    quantity: 2,
  });
  assert.deepEqual(staleToggle, { outcome: "needs-review", reason: "stale-item" });

  const staleDelete = await removeShoppingItem(aliceDb, "alice", base);
  assert.deepEqual(staleDelete, { outcome: "needs-review", reason: "stale-item" });

  let bobBlocked = false;
  try {
    await removeShoppingItem(bobDb, "alice", checked);
  } catch {
    bobBlocked = true;
  }
  assert.equal(bobBlocked, true, "Bob must not mutate Alice shopping row");

  const removed = await removeShoppingItem(aliceDb, "alice", checked);
  assert.deepEqual(removed, { outcome: "applied" });

  const missing = await removeShoppingItem(aliceDb, "alice", checked);
  assert.deepEqual(missing, { outcome: "needs-review", reason: "missing-item" });

  const bulkA = { ...base, id: "bulk-a", name: "Beans" };
  const bulkB = { ...base, id: "bulk-b", name: "Tomatoes", quantity: 2 };
  const bulkCreated = await createShoppingItems(aliceDb, "alice", [bulkA, bulkB]);
  assert.deepEqual(bulkCreated, { outcome: "applied" });

  const duplicateBulk = await createShoppingItems(aliceDb, "alice", [
    { ...base, id: "bulk-c", name: "Milk" },
    bulkB,
  ]);
  assert.deepEqual(duplicateBulk, { outcome: "needs-review", reason: "stale-item" });

  const staleBulkClear = await clearShoppingItems(aliceDb, "alice", [
    bulkA,
    { ...bulkB, quantity: 99 },
  ]);
  assert.deepEqual(staleBulkClear, { outcome: "needs-review", reason: "stale-item" });

  const exactBulkClear = await clearShoppingItems(aliceDb, "alice", [bulkB, bulkA]);
  assert.deepEqual(exactBulkClear, { outcome: "applied" });

  const shortageCandidate = {
    name: "Milk",
    quantity: 1,
    unit: "l",
    category: "Dairy",
    amountOrigin: "deterministic_shortfall",
    purchaseAmountConfirmed: false,
    reason: "Needed for plan",
  };
  const derivedCreated = await reconcileDerivedShortagesAtomically(
    aliceDb, "alice", [], [shortageCandidate],
  );
  assert.equal(derivedCreated.outcome, "applied");
  assert.equal(derivedCreated.next.length, 1);
  const derivedRow = derivedCreated.next[0];

  const derivedNoChange = await reconcileDerivedShortagesAtomically(
    aliceDb, "alice", [derivedRow], [shortageCandidate],
  );
  assert.equal(derivedNoChange.outcome, "no-change");

  const derivedUpdated = await reconcileDerivedShortagesAtomically(
    aliceDb, "alice", [derivedRow], [{ ...shortageCandidate, quantity: 2 }],
  );
  assert.equal(derivedUpdated.outcome, "applied");
  assert.equal(derivedUpdated.next[0].quantity, 2);

  const staleDerived = await reconcileDerivedShortagesAtomically(
    aliceDb, "alice", [derivedRow], [],
  );
  assert.deepEqual(staleDerived, {
    outcome: "needs-review",
    reason: "stale-derived-baseline",
  });

  const removedDerived = await reconcileDerivedShortagesAtomically(
    aliceDb, "alice", derivedUpdated.next, [],
  );
  assert.equal(removedDerived.outcome, "applied");

  console.log("shopping mutation emulator: PASS");
} finally {
  await env.cleanup();
}
