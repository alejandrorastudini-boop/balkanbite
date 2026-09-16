import test from "node:test";
import assert from "node:assert/strict";
import { admitSuccessfulScanItems } from "../src/utils/safeScanResult";

const candidate = { name: "Yogurt" };

test("scanner failures and empty or malformed results produce zero candidates", () => {
  assert.deepEqual(admitSuccessfulScanItems(undefined, [candidate]), []);
  assert.deepEqual(admitSuccessfulScanItems({}, [candidate]), []);
  assert.deepEqual(admitSuccessfulScanItems({ success: false }, [candidate]), []);
  assert.deepEqual(admitSuccessfulScanItems({ success: true }, undefined), []);
  assert.deepEqual(admitSuccessfulScanItems({ success: true }, []), []);
});

test("only explicit successful results admit object candidates", () => {
  assert.deepEqual(
    admitSuccessfulScanItems<{ name: string }>({ success: true }, [null, "Yogurt", candidate]),
    [candidate],
  );
});
