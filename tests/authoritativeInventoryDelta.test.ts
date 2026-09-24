import assert from "node:assert/strict";
import test from "node:test";
import type { PantryItem } from "../src/types";
import {
  planAuthoritativeInventoryDelta,
  type InventoryDeltaRequest,
  type RemoteStockRow,
} from "../src/utils/authoritativeInventoryDelta";

const stock = (
  id: string, quantity: number, cookRevision?: number,
): RemoteStockRow => ({
  id, name: "Rice", quantity, unit: "g", category: "Pantry/Grains",
  addedAt: "2026-09-24", ...(cookRevision === undefined ? {} : { cookRevision }),
});
const baseline = [stock("lot-1", 100, 2), stock("lot-2", 250, 0)];
const request = (
  desired: PantryItem[],
  explicitlyRemovedIds: string[] = [],
): InventoryDeltaRequest => ({
  userId: "alice", remoteOwnerUserId: "alice",
  remoteSnapshotComplete: true,
  remote: baseline,
  desired,
  explicitlyRemovedIds,
});

test("unchanged hydrated pantry generates NO batch or transactional writes", () => {
  const plan = planAuthoritativeInventoryDelta(request([
    { ...baseline[0] }, { ...baseline[1] },
  ]));
  assert.deepEqual(plan, {
    outcome: "ready", unchangedIds: ["lot-1", "lot-2"],
    adjustments: [],
  });
});

test("one quantity edit never resends unrelated pantry lots", () => {
  const plan = planAuthoritativeInventoryDelta(request([
    { ...baseline[0], quantity: 75 }, { ...baseline[1] },
  ]));
  assert.equal(plan.outcome, "ready");
  if (plan.outcome !== "ready") return;
  assert.deepEqual(plan.unchangedIds, ["lot-2"]);
  assert.deepEqual(plan.adjustments, [{
    pantryItemId: "lot-1",
    expected: { pantryItemId: "lot-1", quantity: 100, unit: "g", cookRevision: 2 },
    adjustment: { kind: "set-quantity", quantity: 75 },
  }]);
});

test("explicit deletion plans only the selected lot as a versioned tombstone", () => {
  const plan = planAuthoritativeInventoryDelta(request(
    [{ ...baseline[1] }], ["lot-1"],
  ));
  assert.equal(plan.outcome, "ready");
  if (plan.outcome !== "ready") return;
  assert.deepEqual(plan.adjustments, [{
    pantryItemId: "lot-1",
    expected: { pantryItemId: "lot-1", quantity: 100, unit: "g", cookRevision: 2 },
    adjustment: { kind: "remove" },
  }]);
  assert.deepEqual(plan.unchangedIds, ["lot-2"]);
});

test("an absent row without explicit removal is NOT treated as a deletion", () => {
  const plan = planAuthoritativeInventoryDelta(request([{ ...baseline[1] }]));
  assert.deepEqual(plan, {
    outcome: "needs-review",
    issues: [{ pantryItemId: "lot-1", reason: "unexpected-omission" }],
    adjustments: [],
  });
});

test("account mismatch or incomplete hydration cannot authorize a write", () => {
  for (const changed of [
    { remoteOwnerUserId: "bob" }, { remoteSnapshotComplete: false },
    { userId: "" },
  ]) {
    const plan = planAuthoritativeInventoryDelta({
      ...request([{ ...baseline[0], quantity: 75 }, { ...baseline[1] }]),
      ...changed,
    });
    assert.equal(plan.outcome, "needs-review");
    if (plan.outcome === "needs-review") {
      assert.equal(plan.issues[0]?.reason, "authority-unavailable");
      assert.deepEqual(plan.adjustments, []);
    }
  }
});

test("new rows, metadata edits, bad quantities and ambiguous IDs fail closed", () => {
  const scenarios: Array<{ req: InventoryDeltaRequest; reason: string }> = [
    {
      req: request([{ ...baseline[0] }, { ...baseline[1] },
        stock("new-unknown", 20)]),
      reason: "new-item-needs-confirmation",
    },
    {
      req: request([{ ...baseline[0], unit: "kg" }, { ...baseline[1] }]),
      reason: "unsupported-edit",
    },
    {
      req: request([{ ...baseline[0], quantity: 0 }, { ...baseline[1] }]),
      reason: "invalid-quantity",
    },
    {
      req: request([{ ...baseline[0] }, { ...baseline[0] }, { ...baseline[1] }]),
      reason: "invalid-or-duplicate-id",
    },
    {
      req: request([{ ...baseline[0] }, { ...baseline[1] }], ["lot-1"]),
      reason: "ambiguous-removal",
    },
  ];
  for (const { req, reason } of scenarios) {
    const plan = planAuthoritativeInventoryDelta(req);
    assert.equal(plan.outcome, "needs-review", reason);
    if (plan.outcome === "needs-review") {
      assert.ok(plan.issues.some(issue => issue.reason === reason), reason);
      assert.deepEqual(plan.adjustments, []);
    }
  }
});

test("missing legacy revision requires authoritative snapshot to become zero", () => {
  const remote = [stock("legacy", 90)];
  const req: InventoryDeltaRequest = {
    userId: "alice", remoteOwnerUserId: "alice",
    remoteSnapshotComplete: true,
    remote,
    desired: [{ ...remote[0], quantity: 80 }],
    explicitlyRemovedIds: [],
  };
  assert.deepEqual(planAuthoritativeInventoryDelta(req), {
    outcome: "ready",
    unchangedIds: [],
    adjustments: [{
      pantryItemId: "legacy",
      expected: { pantryItemId: "legacy", quantity: 90, unit: "g", cookRevision: 0 },
      adjustment: { kind: "set-quantity", quantity: 80 },
    }],
  });
  const invalid = planAuthoritativeInventoryDelta({
    ...req, remote: [{ ...remote[0], cookRevision: -1 }],
  });
  assert.equal(invalid.outcome, "needs-review");
  if (invalid.outcome === "needs-review") {
    assert.equal(invalid.issues[0]?.reason, "invalid-remote-stock");
    assert.deepEqual(invalid.adjustments, []);
  }
});

test("duplicate remote stock identities and unknown explicit removals block all writes", () => {
  const duplicate = planAuthoritativeInventoryDelta({
    ...request([{ ...baseline[0], quantity: 75 }, { ...baseline[1] }]),
    remote: [baseline[0], { ...baseline[0], quantity: 40 }, baseline[1]],
  });
  assert.equal(duplicate.outcome, "needs-review");
  if (duplicate.outcome === "needs-review") {
    assert.ok(duplicate.issues.some(issue =>
      issue.reason === "invalid-or-duplicate-id"));
    assert.deepEqual(duplicate.adjustments, []);
  }

  const unknownRemoval = planAuthoritativeInventoryDelta(
    request([{ ...baseline[0], quantity: 75 }, { ...baseline[1] }],
      ["unknown-remote-id"]),
  );
  assert.equal(unknownRemoval.outcome, "needs-review");
  if (unknownRemoval.outcome === "needs-review") {
    assert.deepEqual(unknownRemoval.adjustments, []);
    assert.ok(unknownRemoval.issues.some(issue =>
      issue.reason === "ambiguous-removal"));
  }
});
