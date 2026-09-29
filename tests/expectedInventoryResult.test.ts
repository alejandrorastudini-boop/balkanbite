import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedInventoryResultVisible } from "../src/utils/expectedInventoryResult";

const lot = (id: string, quantity: number) => ({
  id,
  name: id,
  quantity,
  unit: "kg",
  category: "test",
  addedAt: "2026-09-29",
});

test("requires non-empty explicit evidence", () => {
  assert.equal(isExpectedInventoryResultVisible({}, [lot("rice", 1)]), false);
});

test("matches exact affected quantity while allowing unrelated lots", () => {
  assert.equal(
    isExpectedInventoryResultVisible({ rice: 0.5 }, [
      lot("rice", 0.5),
      lot("beans", 4),
    ]),
    true,
  );
});

test("rejects stale affected quantity", () => {
  assert.equal(
    isExpectedInventoryResultVisible({ rice: 0.5 }, [lot("rice", 1)]),
    false,
  );
});

test("null requires the affected lot to be absent", () => {
  assert.equal(
    isExpectedInventoryResultVisible({ rice: null }, [lot("beans", 2)]),
    true,
  );
  assert.equal(
    isExpectedInventoryResultVisible({ rice: null }, [lot("rice", 1)]),
    false,
  );
});

test("all affected lots must match", () => {
  assert.equal(
    isExpectedInventoryResultVisible(
      { rice: 0.5, milk: null },
      [lot("rice", 0.5), lot("milk", 1)],
    ),
    false,
  );
});

test("invalid expected quantities never authorize propagation", () => {
  assert.equal(
    isExpectedInventoryResultVisible({ rice: Number.NaN }, [lot("rice", Number.NaN)]),
    false,
  );
  assert.equal(
    isExpectedInventoryResultVisible({ rice: -1 }, [lot("rice", -1)]),
    false,
  );
});
