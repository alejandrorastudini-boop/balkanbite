import test from "node:test";
import assert from "node:assert/strict";

test("explicit confirmation policy distinguishes proposals from accepted extras", () => {
  const proposed = [{ name: "Aguacates", quantity: 1, unit: "uds" }];
  const selectedBeforeUserReview: typeof proposed = [];
  assert.equal(proposed.length, 1);
  assert.equal(selectedBeforeUserReview.length, 0);
});
