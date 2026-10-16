import assert from "node:assert/strict";
import test from "node:test";
import { GUEST_PANTRY_KEY } from "../src/utils/guestPantry";
import { repairGuestDerivedShoppingOnHydration } from "../src/utils/guestDerivedShoppingRecovery";
import type { PantryItem, ShoppingItem } from "../src/types";

const pantry: PantryItem[] = [{
  id: "qa-food", name: "QA rice", quantity: 550, unit: "g",
  category: "Pantry/Grains", addedAt: "fixture",
}];
const manual: ShoppingItem = {
  id: "qa-personal-shopping", name: "QA personal purchase",
  quantity: 2, unit: "ud", category: "Other", checked: false,
  amountOrigin: "user_entered", purchaseAmountConfirmed: false,
  reason: "This is a user note: preserve me",
};
const stale: ShoppingItem = {
  id: "shortage-v1:qa-stale", name: "QA old missing amount",
  quantity: 100, unit: "g", category: "Other", checked: false,
  amountOrigin: "deterministic_shortfall", purchaseAmountConfirmed: false,
};
const PANTRY = GUEST_PANTRY_KEY;
const SHOPPING = "balkanbite_shopping";
const PLAN = "balkanbite_mealplan";
function storageFixture(data: Record<string, string>) {
  const values = new Map(Object.entries(data));
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  };
}

test("guest hydration repairs only app-managed stale shortages and preserves manual rows", () => {
  const initial = JSON.stringify([manual, stale]);
  const { values, storage } = storageFixture({
    [PANTRY]: JSON.stringify(pantry), [PLAN]: "[]", [SHOPPING]: initial,
  });
  const result = repairGuestDerivedShoppingOnHydration(storage, "en");
  assert.deepEqual(result, { status: "repaired", shopping: [manual] });
  assert.equal(values.get(SHOPPING), JSON.stringify([manual]));
  assert.equal(values.get(PANTRY), JSON.stringify(pantry));
  assert.equal(values.get(PLAN), "[]");
  assert.deepEqual(repairGuestDerivedShoppingOnHydration(storage, "en"), {
    status: "unchanged",
  });
});

test("guest hydration does not assume missing plan, stock or list means known empty", () => {
  for (const omitted of [PANTRY, SHOPPING, PLAN]) {
    const fixture = {
      [PANTRY]: JSON.stringify(pantry), [PLAN]: "[]",
      [SHOPPING]: JSON.stringify([manual, stale]),
    };
    delete fixture[omitted];
    const { values, storage } = storageFixture(fixture);
    assert.deepEqual(repairGuestDerivedShoppingOnHydration(storage, "bg"), {
      status: "unchanged",
    });
    assert.equal(values.get(SHOPPING), fixture[SHOPPING]);
  }
});

test("guest hydration never discards malformed stored plan or shopping rows", () => {
  for (const fixture of [
    { [PLAN]: '[{"date":"bad"}]' },
    { [SHOPPING]: JSON.stringify([manual, { id: "partial-row" }]) },
    { [SHOPPING]: "invalid-json" },
  ]) {
    const initial = {
      [PANTRY]: JSON.stringify(pantry), [PLAN]: "[]",
      [SHOPPING]: JSON.stringify([manual, stale]),
      ...fixture,
    };
    const { storage, values } = storageFixture(initial);
    assert.deepEqual(repairGuestDerivedShoppingOnHydration(storage, "es"), {
      status: "blocked",
    });
    assert.equal(values.get(SHOPPING), initial[SHOPPING]);
  }
});

test("legacy pantry awaiting quarantine review never rewrites derived shopping", () => {
  const initial = JSON.stringify([manual, stale]);
  const { values, storage } = storageFixture({
    [PANTRY]: JSON.stringify([...pantry, { id: "broken" }]),
    [PLAN]: "[]", [SHOPPING]: initial,
  });
  assert.deepEqual(repairGuestDerivedShoppingOnHydration(storage, "en"), {
    status: "unchanged",
  });
  assert.equal(values.get(SHOPPING), initial);
});

test("silent or thrown shopping failure is rejected without publishing repaired rows", () => {
  for (const mode of ["silent", "quota"]) {
    const initial = JSON.stringify([manual, stale]);
    const { values, storage } = storageFixture({
      [PANTRY]: JSON.stringify(pantry), [PLAN]: "[]", [SHOPPING]: initial,
    });
    const faulty = {
      getItem: storage.getItem,
      setItem: (key: string, value: string) => {
        if (key === SHOPPING) {
          if (mode === "quota") throw new Error("quota");
          return;
        }
        storage.setItem(key, value);
      },
    };
    assert.deepEqual(repairGuestDerivedShoppingOnHydration(faulty, "en"), {
      status: "blocked",
    });
    assert.equal(values.get(SHOPPING), initial);
  }
});

test("concurrent change of input plan prevents blind derived overwrite", () => {
  const initial = JSON.stringify([manual, stale]);
  const { values, storage } = storageFixture({
    [PANTRY]: JSON.stringify(pantry), [PLAN]: "[]", [SHOPPING]: initial,
  });
  let planReads = 0;
  const raced = {
    getItem: (key: string) => {
      if (key === PLAN) {
        planReads++;
        if (planReads === 2) values.set(PLAN, "not-a-valid-plan");
      }
      return storage.getItem(key);
    },
    setItem: storage.setItem,
  };
  assert.deepEqual(repairGuestDerivedShoppingOnHydration(raced, "en"), {
    status: "blocked",
  });
  assert.equal(values.get(SHOPPING), initial);
});
