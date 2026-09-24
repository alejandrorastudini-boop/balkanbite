import assert from "node:assert/strict";
import test from "node:test";
import {
  submitVerifiedPantryEdit,
  type VerifiedPantryEditCommand,
} from "../src/utils/verifiedPantryEditCommand";
import {
  verifyServerInventoryForEdits,
  type InventoryEditAuthority,
} from "../src/utils/pantryEditIntentCapture";
import type {
  InventoryAdjustmentOutcome,
  VerifiedStockExpectation,
  InventoryAdjustment,
} from "../src/utils/inventoryAdjustmentFirestore";

const authority = (): InventoryEditAuthority =>
  verifyServerInventoryForEdits({
    userId: "alice",
    fromCache: false,
    hasPendingWrites: false,
    documents: [{
      documentId: "u_alice__rice",
      hasPendingWrites: false,
      data: {
        userId: "alice", id: "rice", quantity: 100, unit: "g",
        cookRevision: 2, _deleted: false,
      },
    }],
  });

const viewed = () => ({
  id: "rice", quantity: 100, unit: "g", cookRevision: 2,
});

const makeCommand = (
  overrides: Partial<VerifiedPantryEditCommand> = {},
): VerifiedPantryEditCommand => ({
  authority: authority(),
  viewed: viewed(),
  adjustment: { kind: "set-quantity", quantity: 80 },
  getCurrentUserId: () => "alice",
  persist: async (_userId, expected, adjustment) => ({
    outcome: adjustment.kind === "remove" ? "removed" : "updated",
    ...(adjustment.kind === "remove" ? {} : { quantity: adjustment.quantity }),
    cookRevision: expected.cookRevision + 1,
  } as InventoryAdjustmentOutcome),
  ...overrides,
});

test("dispatches exact click-time user-owned baseline and only one explicit edit", async () => {
  const writes: {
    userId: string; expected: VerifiedStockExpectation;
    adjustment: InventoryAdjustment;
  }[] = [];
  const result = await submitVerifiedPantryEdit(makeCommand({
    persist: async (userId, expected, adjustment) => {
      writes.push({ userId, expected, adjustment });
      return { outcome: "updated", quantity: 80, cookRevision: 3 };
    },
  }));
  assert.deepEqual(result, { outcome: "updated", quantity: 80, cookRevision: 3 });
  assert.deepEqual(writes, [{
    userId: "alice",
    expected: { pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 2 },
    adjustment: { kind: "set-quantity", quantity: 80 },
  }]);
});

test("explicit removal retains original stock baseline", async () => {
  let captured: VerifiedStockExpectation | null = null;
  const result = await submitVerifiedPantryEdit(makeCommand({
    adjustment: { kind: "remove" },
    persist: async (_, expected) => {
      captured = expected;
      return { outcome: "removed", cookRevision: 3 };
    },
  }));
  assert.deepEqual(result, { outcome: "removed", cookRevision: 3 });
  assert.deepEqual(captured, {
    pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 2,
  });
});

test("cache/pending metadata and other-account authority NEVER call the writer", async () => {
  let writes = 0;
  const cases: Partial<VerifiedPantryEditCommand>[] = [
    { authority: { status: "unavailable", reason: "unverified-snapshot" } },
    { getCurrentUserId: () => null },
    { getCurrentUserId: () => "bob" },
    { viewed: { ...viewed(), cookRevision: 1 } },
    { viewed: { ...viewed(), quantity: 90 } },
    { viewed: { ...viewed(), unit: "kg" } },
    { viewed: { id: "missing", quantity: 100, unit: "g" } },
  ];
  for (const candidate of cases) {
    const result = await submitVerifiedPantryEdit(makeCommand({
      ...candidate,
      persist: async () => {
        writes += 1;
        return { outcome: "updated", quantity: 80, cookRevision: 3 };
      },
    }));
    assert.equal(result.outcome, "needs-review");
  }
  assert.equal(writes, 0);
});

test("invalid, unchanged or unconfirmed quantity cannot start a transaction", async () => {
  let writes = 0;
  for (const quantity of [0, -2, Number.NaN, Number.POSITIVE_INFINITY, 100]) {
    const result = await submitVerifiedPantryEdit(makeCommand({
      adjustment: { kind: "set-quantity", quantity },
      persist: async () => {
        writes += 1;
        return { outcome: "updated", quantity: 80, cookRevision: 3 };
      },
    }));
    assert.deepEqual(result, {
      outcome: "needs-review",
      reason: quantity === 100 ? "no-change" : "invalid-request",
    });
  }
  assert.equal(writes, 0);
});

test("account switch before transaction dispatch fails without touching stock", async () => {
  let calls = 0;
  let writes = 0;
  const result = await submitVerifiedPantryEdit(makeCommand({
    getCurrentUserId: () => ++calls === 1 ? "alice" : "bob",
    persist: async () => {
      writes += 1;
      return { outcome: "updated", quantity: 80, cookRevision: 3 };
    },
  }));
  assert.deepEqual(result, { outcome: "needs-review", reason: "account-changed" });
  assert.equal(writes, 0);
});

test("server-side stale rejection remains visible rather than fabricated success", async () => {
  const result = await submitVerifiedPantryEdit(makeCommand({
    persist: async () => ({ outcome: "needs-review", reason: "stale-stock" }),
  }));
  assert.deepEqual(result, { outcome: "needs-review", reason: "stale-stock" });
});

test("offline, permission and transaction errors propagate; no silent local success", async () => {
  for (const reason of ["offline", "permission-denied", "aborted"]) {
    await assert.rejects(
      submitVerifiedPantryEdit(makeCommand({
        persist: async () => { throw new Error(reason); },
      })),
      new RegExp(reason),
    );
  }
});
