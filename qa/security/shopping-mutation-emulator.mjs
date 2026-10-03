import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { createShoppingItem, removeShoppingItem, replaceShoppingItem } from "../../src/utils/shoppingMutationFirestore.ts";

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

  console.log("shopping mutation emulator: PASS");
} finally {
  await env.cleanup();
}
