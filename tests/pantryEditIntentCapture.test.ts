import assert from "node:assert/strict";
import test from "node:test";
import {
  capturePantryEditIntent,
  verifyServerInventoryForEdits,
  type FirestoreInventorySnapshotEvidence,
} from "../src/utils/pantryEditIntentCapture";

const inventory = (
  documents: FirestoreInventorySnapshotEvidence["documents"] = [{
    documentId: "u_alice__rice",
    hasPendingWrites: false,
    data: {
      userId: "alice", id: "rice", quantity: 100, unit: "g",
      cookRevision: 2, _deleted: false,
    },
  }],
): FirestoreInventorySnapshotEvidence => ({
  userId: "alice", fromCache: false, hasPendingWrites: false, documents,
});

test("captures exact server-verified row as the original UI edit baseline", () => {
  const authority = verifyServerInventoryForEdits(inventory());
  assert.deepEqual(authority, {
    status: "verified",
    userId: "alice",
    observed: [{
      pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 2,
    }],
  });
  assert.deepEqual(capturePantryEditIntent(authority, "alice", {
    id: "rice", quantity: 100, unit: "g", cookRevision: 2,
  }), {
    outcome: "captured",
    observedBeforeEdit: {
      pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 2,
    },
  });
});

test("cached and locally pending snapshots cannot authorize editing", () => {
  for (const evidence of [
    { fromCache: true },
    { hasPendingWrites: true },
    { documents: [{ ...inventory().documents[0], hasPendingWrites: true }] },
    { userId: "" },
  ]) {
    const result = verifyServerInventoryForEdits({
      ...inventory(), ...evidence,
    } as FirestoreInventorySnapshotEvidence);
    assert.deepEqual(result, {
      status: "unavailable", reason: "unverified-snapshot",
    });
  }
});

test("foreign, malformed, legacy-only and duplicate rows invalidate the whole owner snapshot", () => {
  const original = inventory().documents[0];
  const cases = [
    [{ ...original, data: { ...original.data, userId: "bob" } }],
    [{ ...original, documentId: "u_bob__rice" }],
    [{ ...original, documentId: "rice" }],
    [{ ...original, data: { ...original.data, cookRevision: -1 } }],
    [{ ...original, data: { ...original.data, quantity: NaN } }],
    [original, { ...original }],
  ] as FirestoreInventorySnapshotEvidence["documents"][];
  for (const documents of cases) {
    const authority = verifyServerInventoryForEdits(inventory(documents));
    assert.notEqual(authority.status, "verified");
  }
});

test("a changed remote version, quantity or unit never rebases the old UI intent", () => {
  const authority = verifyServerInventoryForEdits(inventory());
  for (const viewed of [
    { id: "rice", quantity: 100, unit: "g", cookRevision: 1 },
    { id: "rice", quantity: 90, unit: "g", cookRevision: 2 },
    { id: "rice", quantity: 100, unit: "kg", cookRevision: 2 },
    { id: "rice", quantity: 100, unit: "g" },
  ]) {
    assert.deepEqual(capturePantryEditIntent(authority, "alice", viewed), {
      outcome: "needs-review", reason: "stale-local-view",
    });
  }
});

test("a different signed-in account cannot reuse the prior user's authority", () => {
  const authority = verifyServerInventoryForEdits(inventory());
  assert.deepEqual(capturePantryEditIntent(authority, "bob", {
    id: "rice", quantity: 100, unit: "g", cookRevision: 2,
  }), { outcome: "needs-review", reason: "unverified-authority" });
});

test("missing, unverified and deleted lots cannot be captured", () => {
  const authority = verifyServerInventoryForEdits(inventory());
  assert.deepEqual(capturePantryEditIntent(authority, "alice", {
    id: "unknown", quantity: 100, unit: "g",
  }), { outcome: "needs-review", reason: "missing-stock" });
  const deleted = verifyServerInventoryForEdits(inventory([{
    ...inventory().documents[0],
    data: { ...inventory().documents[0].data, _deleted: true },
  }]));
  assert.deepEqual(capturePantryEditIntent(deleted, "alice", {
    id: "rice", quantity: 100, unit: "g", cookRevision: 2,
  }), { outcome: "needs-review", reason: "missing-stock" });
});

test("genuine unversioned legacy quantity is zero revision only after server verification", () => {
  const evidence = inventory([{
    documentId: "u_alice__rice",
    hasPendingWrites: false,
    data: { userId: "alice", id: "rice", quantity: 100, unit: "g" },
  }]);
  const authority = verifyServerInventoryForEdits(evidence);
  assert.deepEqual(capturePantryEditIntent(authority, "alice", {
    id: "rice", quantity: 100, unit: "g",
  }), {
    outcome: "captured",
    observedBeforeEdit: {
      pantryItemId: "rice", quantity: 100, unit: "g", cookRevision: 0,
    },
  });
});

test("server-confirmed empty pantry is valid but cannot authorize unknown item mutations", () => {
  const authority = verifyServerInventoryForEdits(inventory([]));
  assert.deepEqual(authority, { status: "verified", userId: "alice", observed: [] });
  assert.deepEqual(capturePantryEditIntent(authority, "alice", {
    id: "rice", quantity: 100, unit: "g",
  }), { outcome: "needs-review", reason: "missing-stock" });
});
