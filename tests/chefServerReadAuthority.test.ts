import test from "node:test";
import assert from "node:assert/strict";
import type { MealPlanDay, ShoppingItem } from "../src/types";
import {
  deriveChefServerCollectionRead,
  deriveChefServerProgressRead,
  selectCompleteChefServerWorkspace,
} from "../src/utils/chefServerReadAuthority";

const server = { fromCache: false, hasPendingWrites: false };
const menu: MealPlanDay = { date: "2026-10-17" };
const shopping: ShoppingItem = {
  id: "salt-1", name: "Salt", quantity: 1, unit: "kg",
  category: "Other", checked: false, amountOrigin: "user_entered",
};
const event = {
  version: 1, eventId: "purchase:one",
  type: "confirmed_purchase_applied",
  occurredAt: "2026-10-17T05:00:00.000Z",
  evidence: "deterministic_state_transition",
  evidenceCount: 1,
};
const doc = (id: string, data: Record<string, unknown>, hasPendingWrites = false) =>
  ({ documentId: id, data: { userId: "owner-a", ...data }, hasPendingWrites });

test("only complete owner/server-confirmed meal and shopping snapshots are authoritative", () => {
  const menuDocs = [doc("menu-day", menu)];
  const shoppingDocs = [doc("salt-1", shopping)];
  assert.deepEqual(deriveChefServerCollectionRead("mealPlans", "owner-a", server, menuDocs),
    { userId: "owner-a", serialized: JSON.stringify([menu]) });
  assert.deepEqual(deriveChefServerCollectionRead("shoppingList", "owner-a", server, shoppingDocs),
    { userId: "owner-a", serialized: JSON.stringify([shopping]) });
  assert.deepEqual(deriveChefServerCollectionRead("mealPlans", "owner-a", server, []),
    { userId: "owner-a", serialized: "[]" },
    "server-confirmed empty is allowed, not fabricated by default");
  for (const metadata of [
    { ...server, fromCache: true },
    { ...server, hasPendingWrites: true },
  ]) {
    assert.equal(deriveChefServerCollectionRead("mealPlans", "owner-a", metadata, menuDocs), null);
    assert.equal(deriveChefServerCollectionRead("shoppingList", "owner-a", metadata, shoppingDocs), null);
  }
  assert.equal(deriveChefServerCollectionRead("mealPlans", "owner-a", server,
    [doc("menu-day", menu, true)]), null);
  assert.equal(deriveChefServerCollectionRead("shoppingList", "owner-a", server,
    [doc("salt-1", shopping, true)]), null);
});

test("no cross-account, duplicate logical row or filtered malformed data can become Chef facts", () => {
  for (const name of ["mealPlans", "shoppingList"] as const) {
    const item = name === "mealPlans" ? menu : shopping;
    const docs = [doc("one", item)];
    assert.equal(deriveChefServerCollectionRead(name, "owner-b", server, docs), null);
    assert.equal(deriveChefServerCollectionRead(name, "owner-a", server,
      [...docs, doc("two", item)]), null, "no silently collapsed legacy duplicate");
    assert.equal(deriveChefServerCollectionRead(name, "owner-a", server,
      [...docs, doc("corrupt", { unrelated: "invalid" })]), null);
    assert.equal(deriveChefServerCollectionRead(name, "owner-a", server,
      [{ documentId: "one", data: item, hasPendingWrites: false }]), null);
  }
});

test("progress proves full valid owner subcollection, rejects invalid, duplicate and local writes", () => {
  const docs = [doc(event.eventId, { ...event, requestSignature: "sig" })];
  assert.deepEqual(deriveChefServerProgressRead("owner-a", server, docs),
    { userId: "owner-a", serialized: JSON.stringify([event]) });
  assert.deepEqual(deriveChefServerProgressRead("owner-a", server, []),
    { userId: "owner-a", serialized: "[]" });
  assert.equal(deriveChefServerProgressRead("owner-b", server, docs), null);
  assert.equal(deriveChefServerProgressRead("owner-a", { ...server, fromCache: true }, docs), null);
  assert.equal(deriveChefServerProgressRead("owner-a", server, [doc(event.eventId, event, true)]), null);
  assert.equal(deriveChefServerProgressRead("owner-a", server,
    [...docs, doc("bad", { eventId: "bad" })]), null);
  assert.equal(deriveChefServerProgressRead("owner-a", server,
    [...docs, ...docs]), null);
});

test("composite authority gates each of three scopes and exact displayed arrays", () => {
  const a = deriveChefServerCollectionRead("mealPlans", "owner-a", server, [doc("menu-day", menu)])!;
  const b = deriveChefServerCollectionRead("shoppingList", "owner-a", server, [doc("salt-1", shopping)])!;
  const c = deriveChefServerProgressRead("owner-a", server, [doc(event.eventId, event)])!;
  const parts = { mealPlans: a, shoppingList: b, progression: c };
  const visible = { mealPlan: [menu], shopping: [shopping], progression: [event] };
  assert.deepEqual(selectCompleteChefServerWorkspace("owner-a", "owner-a", parts, visible),
    visible);
  assert.equal(selectCompleteChefServerWorkspace("owner-b", "owner-a", parts, visible), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-b", parts, visible), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-a",
    { ...parts, shoppingList: undefined }, visible), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-a",
    { ...parts, progression: { ...c, userId: "owner-b" } }, visible), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-a", parts,
    { ...visible, shopping: [] }), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-a", parts,
    { ...visible, progression: [] }), null);
  assert.equal(selectCompleteChefServerWorkspace("owner-a", "owner-a", parts,
    { ...visible, mealPlan: [] }), null);
});
