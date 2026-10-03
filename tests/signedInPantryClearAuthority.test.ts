import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const pantry = readFileSync(new URL("../src/components/PantryView.tsx", import.meta.url), "utf8");
const sync = readFileSync(new URL("../src/hooks/useFirebaseSync.ts", import.meta.url), "utf8");
const firestore = readFileSync(new URL("../src/utils/inventoryClearFirestore.ts", import.meta.url), "utf8");

test("signed-in Clear-All never optimistically empties pantry", () => {
  const start = app.indexOf("const handleClearPantry = async");
  const end = app.indexOf("const handleClearRecipes", start);
  const handler = app.slice(start, end);
  const signed = handler.indexOf("if (!currentUser)");
  assert.ok(signed > 0);
  assert.ok(handler.includes("submitInventoryClear(mutationId, pantry)"));
  assert.equal(handler.slice(handler.indexOf("const result")).includes("setPantry([])"), false);
});

test("Clear-All UI preserves one mutation id while confirmation stays unresolved", () => {
  assert.ok(pantry.includes("const [clearMutationId, setClearMutationId]"));
  assert.ok(pantry.includes("if (!clearMutationId)"));
  assert.ok(pantry.includes("await onClearAll(clearMutationId)"));
  assert.ok(pantry.includes("if (accepted)"));
});

test("sync requires exact server-confirmed full visible baseline", () => {
  assert.ok(sync.includes("authority.observed.length !== visiblePantry.length"));
  assert.ok(sync.includes("observed.quantity !== visible.quantity"));
  assert.ok(sync.includes("observed.cookRevision !== revision"));
  assert.ok(sync.includes('reason: "awaiting-server-confirmation"'));
});

test("atomic clear journals before replay and refuses chunked partial clear", () => {
  assert.ok(firestore.includes("const prior = await tx.get(journalRef)"));
  assert.ok(firestore.includes("baseline.length > 200"));
  assert.ok(firestore.includes("for (const { expected, ref } of stockRefs)"));
  assert.ok(firestore.includes("tx.set(journalRef"));
  assert.equal(firestore.includes("writeBatch"), false);
});
