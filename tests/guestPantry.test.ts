import assert from "node:assert/strict";
import test from "node:test";
import {
  GUEST_PANTRY_KEY,
  GUEST_PANTRY_QUARANTINE_KEY,
  inspectGuestPantry,
  loadGuestPantry,
  writeGuestPantrySafely,
} from "../src/utils/guestPantry";
import { isLegacyDemoPantryItemId } from "../src/utils/legacyDemoPantryIds";
import type { PantryItem } from "../src/types";

const realItem: PantryItem = {
  id: "guest-real-rice",
  name: "Rice",
  quantity: 500,
  unit: "g",
  category: "Pantry/Grains",
  addedAt: "fixture",
};

const legacyDemoRow = (id: "sp-1" | "sp-14"): PantryItem => ({
  id,
  name: "Historical demo fixture",
  quantity: 1,
  unit: "fixture-unit",
  category: "Other",
  addedAt: "fixture",
});

test("missing or malformed guest pantry state stays empty", () => {
  assert.deepEqual(loadGuestPantry(null), []);
  assert.deepEqual(loadGuestPantry("not-json"), []);
  assert.deepEqual(loadGuestPantry(JSON.stringify({ pantry: [] })), []);
});

test("historical demo pantry ids remain blocked without retaining demo food facts", () => {
  assert.equal(isLegacyDemoPantryItemId("sp-1"), true);
  assert.equal(isLegacyDemoPantryItemId("sp-14"), true);
  assert.equal(isLegacyDemoPantryItemId("sp-15"), false);
  assert.equal(isLegacyDemoPantryItemId("guest-real-rice"), false);

  assert.deepEqual(
    loadGuestPantry(JSON.stringify([legacyDemoRow("sp-1"), legacyDemoRow("sp-14")])),
    [],
  );
});

test("legacy demo rows are removed without deleting real guest items", () => {
  const loaded = loadGuestPantry(
    JSON.stringify([legacyDemoRow("sp-1"), realItem, legacyDemoRow("sp-14")]),
  );

  assert.deepEqual(loaded, [realItem]);
});

test("malformed legacy guest rows are quarantined, not counted as real stock", () => {
  const mixed = JSON.stringify([
    realItem,
    { id: "ghost-without-quantity" },
    { ...realItem, id: "invalid-qty", quantity: -10 },
    { ...realItem, id: "invalid-lot", lotState: { version: 1, unallocatedQuantity: 100, activeLots: [] } },
    null,
  ]);
  assert.deepEqual(inspectGuestPantry(mixed), {
    items: [realItem],
    requiresRecovery: true,
    quarantinedCount: 4,
  });
  assert.deepEqual(loadGuestPantry(mixed), [realItem]);
  assert.deepEqual(inspectGuestPantry("{broken"), {
    items: [], requiresRecovery: true, quarantinedCount: null,
  });
  assert.deepEqual(inspectGuestPantry(JSON.stringify({ pantry: [realItem] })), {
    items: [], requiresRecovery: true, quarantinedCount: null,
  });
});

test("guest pantry rejects duplicate IDs and malformed financial/provenance metadata", () => {
  const invalid = [
    realItem,
    { ...realItem },
    { ...realItem, id: "bad-price", estimatedCostEUR: "unknown" },
    { ...realItem, id: "bad-history", purchaseHistory: [{ sourceId: "bad" }] },
    { ...realItem, id: "bad-expiry", expiryDaysLeft: "soon" },
  ];
  assert.deepEqual(inspectGuestPantry(JSON.stringify(invalid)), {
    items: [realItem], requiresRecovery: true, quarantinedCount: 4,
  });
});

test("safe guest persistence preserves the exact original bytes before any rewrite", () => {
  const raw = '[{"id":"ghost-without-quantity","notes":"please keep untouched"}, null]';
  const values = new Map<string, string>([[GUEST_PANTRY_KEY, raw]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const result = writeGuestPantrySafely(storage, [realItem]);
  assert.deepEqual(result, { saved: true, recoveryAvailable: true });
  assert.equal(values.get(GUEST_PANTRY_QUARANTINE_KEY), raw);
  assert.deepEqual(JSON.parse(values.get(GUEST_PANTRY_KEY)!), [realItem]);

  // Normal subsequent writes keep the original recovery copy intact.
  assert.deepEqual(writeGuestPantrySafely(storage, [realItem]), {
    saved: true, recoveryAvailable: true,
  });
  assert.equal(values.get(GUEST_PANTRY_QUARANTINE_KEY), raw);
});

test("backup failure or conflict blocks writes without destroying original guest state", () => {
  const raw = '[{"id":"ghost"}]';
  const values = new Map<string, string>([[GUEST_PANTRY_KEY, raw]]);
  const failedStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === GUEST_PANTRY_QUARANTINE_KEY) throw new Error("quota exceeded");
      values.set(key, value);
    },
  };
  assert.deepEqual(writeGuestPantrySafely(failedStorage, [realItem]), {
    saved: false, reason: "storage-unavailable",
  });
  assert.equal(values.get(GUEST_PANTRY_KEY), raw);
  assert.equal(values.has(GUEST_PANTRY_QUARANTINE_KEY), false);

  values.set(GUEST_PANTRY_QUARANTINE_KEY, "different older recovery content");
  assert.deepEqual(writeGuestPantrySafely(failedStorage, [realItem]), {
    saved: false, reason: "backup-conflict",
  });
  assert.equal(values.get(GUEST_PANTRY_KEY), raw);
  assert.equal(values.get(GUEST_PANTRY_QUARANTINE_KEY), "different older recovery content");
});

test("malformed memory payloads cannot be persisted as guest pantry", () => {
  const values = new Map<string, string>([[GUEST_PANTRY_KEY, JSON.stringify([realItem])]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.deepEqual(
    writeGuestPantrySafely(storage, [{ id: "not-a-food" } as PantryItem]),
    { saved: false, reason: "invalid-items" },
  );
  const cyclic: Record<string, unknown> = { ...realItem };
  cyclic.self = cyclic;
  assert.deepEqual(
    writeGuestPantrySafely(storage, [cyclic as unknown as PantryItem]),
    { saved: false, reason: "storage-unavailable" },
  );
  assert.deepEqual(JSON.parse(values.get(GUEST_PANTRY_KEY)!), [realItem]);
});

test("known old demo fixtures are skipped without classifying real stock as uncertain", () => {
  const raw = JSON.stringify([legacyDemoRow("sp-1"), realItem]);
  assert.deepEqual(inspectGuestPantry(raw), {
    items: [realItem], requiresRecovery: false, quarantinedCount: 0,
  });
});

test("stale guest tab cannot overwrite another tab's confirmed inventory", () => {
  const initial = [realItem];
  const next = { ...realItem, id: "other-tab-milk", name: "Milk", quantity: 1, unit: "l", category: "Dairy" as const };
  const values = new Map<string, string>([[GUEST_PANTRY_KEY, JSON.stringify(initial)]]);
  let primaryWrites = 0;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === GUEST_PANTRY_KEY) primaryWrites++;
      values.set(key, value);
    },
  };

  // Tab A writes the new item after both tabs originally loaded one row.
  assert.deepEqual(writeGuestPantrySafely(storage, [next, ...initial], initial), {
    saved: true, recoveryAvailable: false,
  });
  const latest = values.get(GUEST_PANTRY_KEY)!;
  assert.equal(primaryWrites, 1);

  // Tab B still holds the old one-row snapshot. An attempted quantity edit
  // must fail closed, without modifying localStorage or backups.
  const staleEdit = [{ ...realItem, quantity: 2 }];
  assert.deepEqual(writeGuestPantrySafely(storage, staleEdit, initial), {
    saved: false, reason: "stale-snapshot",
  });
  assert.equal(primaryWrites, 1);
  assert.equal(values.get(GUEST_PANTRY_KEY), latest);
  assert.equal(values.has(GUEST_PANTRY_QUARANTINE_KEY), false);

  // After reloading tab B from the latest confirmed source, its edit may
  // succeed while preserving tab A's added product.
  const refreshed = inspectGuestPantry(latest).items;
  const revised = refreshed.map(item => item.id === realItem.id ? { ...item, quantity: 2 } : item);
  assert.deepEqual(writeGuestPantrySafely(storage, revised, refreshed), {
    saved: true, recoveryAvailable: false,
  });
  assert.equal(primaryWrites, 2);
  assert.deepEqual(inspectGuestPantry(values.get(GUEST_PANTRY_KEY)!).items, revised);
});
