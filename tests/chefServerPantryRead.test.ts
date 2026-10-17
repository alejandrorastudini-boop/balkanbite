import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { PantryItem } from "../src/types";
import { getScopedDocumentId } from "../src/utils/cloudCollectionSync";
import { deriveChefServerPantryRead, selectCompleteChefServerPantry } from "../src/utils/chefServerReadAuthority";

const uid = "chef-test-user";
const server = { fromCache: false, hasPendingWrites: false };
const rice: PantryItem = {
  id: "qa-rice", name: "QA Rice", quantity: 500, unit: "g",
  category: "Pantry/Grains", addedAt: "2026-10-17", cookRevision: 0,
};
const row = (item: object = rice, options?: {
  documentId?: string; pending?: boolean; owner?: string;
}) => ({
  documentId: options?.documentId ?? getScopedDocumentId(uid, rice.id),
  data: { userId: options?.owner ?? uid, ...item },
  hasPendingWrites: options?.pending ?? false,
});

test("Chef inventory authority needs canonical full server stock and exact React echo", () => {
  const e = deriveChefServerPantryRead(uid, server, [row()]);
  assert.deepEqual(e, { userId: uid, serialized: JSON.stringify([rice]) });
  assert.deepEqual(selectCompleteChefServerPantry(uid, uid, e ?? undefined, [rice]), [rice]);
  assert.equal(selectCompleteChefServerPantry(uid, uid, e ?? undefined,
    [{ ...rice, quantity: 550 }]), null, "no stale 550 g view can pass");
  assert.equal(selectCompleteChefServerPantry(uid, uid, e ?? undefined,
    [{ ...rice, name: "old description" }]), null, "not just quantity/ID proof");
  assert.equal(selectCompleteChefServerPantry(uid, uid, e ?? undefined,
    []), null, "server stock cannot become UI empty assertion");
  assert.equal(selectCompleteChefServerPantry("other", uid, e ?? undefined, [rice]), null);
  assert.equal(selectCompleteChefServerPantry(uid, "other", e ?? undefined, [rice]), null);
  assert.equal(selectCompleteChefServerPantry(uid, uid, undefined, [rice]), null);
});

test("no cache or pending document metadata can produce read authority", () => {
  for (const metadata of [
    { ...server, fromCache: true },
    { ...server, hasPendingWrites: true },
  ]) assert.equal(deriveChefServerPantryRead(uid, metadata, [row()]), null);
  assert.equal(deriveChefServerPantryRead(uid, server, [row(rice, { pending: true })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server, [row(rice, { owner: "foreign" })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row(rice, { documentId: rice.id })]), null,
    "legacy-only stock is not silently promoted to canonical authority");
  assert.equal(deriveChefServerPantryRead(uid, server, [row(), row()]), null);
});

test("reject a malformed active row even if stock numbers are otherwise plausible", () => {
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row({ ...rice, name: "" })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row({ ...rice, category: "unknown category" })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row({ ...rice, quantity: NaN })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row({ ...rice, expiryDaysLeft: -3 })]), null);
  assert.equal(deriveChefServerPantryRead(uid, server,
    [row({ ...rice, addedAt: undefined })]), null);
});

test("server-confirmed empty and tombstones give empty recorded stock, not guessed inventory", () => {
  const empty = deriveChefServerPantryRead(uid, server, []);
  assert.deepEqual(empty, { userId: uid, serialized: "[]" });
  assert.deepEqual(selectCompleteChefServerPantry(uid, uid, empty ?? undefined, []), []);
  const deleted = deriveChefServerPantryRead(uid, server,
    [row({ ...rice, _deleted: true, deletedAt: "2026-10-17T08:00:00Z" })]);
  assert.deepEqual(deleted, { userId: uid, serialized: "[]" });
  assert.equal(selectCompleteChefServerPantry(uid, uid, deleted ?? undefined, [rice]), null);
});

test("hook invalidates inventory evidence and App uses proven rows rather than direct pantry", () => {
  const hook = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(hook, /chefServerReadEvidence\.current\.inventory\s*=\s*authSessionUserId\.current/);
  assert.match(hook, /deriveChefServerPantryRead\(/);
  assert.match(hook, /chefServerReadEvidence\.current\.inventory = undefined/);
  assert.match(hook, /return selectCompleteChefServerPantry\(/);
  assert.match(app, /pantryScope === currentUser\.uid && workspaceScope === currentUser\.uid\s*\? getServerConfirmedChefPantry\(\) : null/);
});
