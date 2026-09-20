import assert from "node:assert/strict";
import test from "node:test";

import {
  getEfsaPalForAdultActivityCategory,
  parseAdultPhysicalActivityCategory,
  resolveExplicitAdultActivitySelection,
  type AdultPhysicalActivityCategory,
} from "../src/utils/adultPhysicalActivity";

const expected: Array<[AdultPhysicalActivityCategory, number]> = [
  ["low_active", 1.4],
  ["moderately_active", 1.6],
  ["active", 1.8],
  ["very_active", 2.0],
];

for (const [category, pal] of expected) {
  test(`explicit activity selection preserves ${category} as approximate PAL ${pal}`, () => {
    const result = resolveExplicitAdultActivitySelection(category);

    assert.deepEqual(result, {
      status: "selected",
      category,
      efsaPal: pal,
      selectionMethod: "explicit_self_report",
      approximate: true,
      autoClassified: false,
      sourceContext: {
        organization: "European Food Safety Authority",
        report: "Scientific Opinion on Dietary Reference Values for energy",
        year: 2013,
        doi: "10.2903/j.efsa.2013.3005",
      },
    });

    assert.equal(getEfsaPalForAdultActivityCategory(category), pal);
    assert.equal(parseAdultPhysicalActivityCategory(category), category);
  });
}

test("missing activity never receives a default PAL", () => {
  assert.deepEqual(resolveExplicitAdultActivitySelection(undefined), {
    status: "insufficient_data",
    missing: ["activityCategory"],
  });
  assert.deepEqual(resolveExplicitAdultActivitySelection(""), {
    status: "insufficient_data",
    missing: ["activityCategory"],
  });
});

test("unknown activity labels are rejected rather than guessed", () => {
  assert.deepEqual(resolveExplicitAdultActivitySelection("sedentary"), {
    status: "invalid_input",
    invalid: ["activityCategory"],
  });
  assert.equal(parseAdultPhysicalActivityCategory("office_worker"), undefined);
});
