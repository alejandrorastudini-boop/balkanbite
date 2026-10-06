import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildBulgarianAdultEnergyReferenceInputFromHealthProfile } from "../src/utils/healthProfileBulgarianEnergyInput";

test("Bulgarian reference adapter excludes personal height and weight", () => {
  const input = buildBulgarianAdultEnergyReferenceInputFromHealthProfile({
    version: 1,
    ageYears: { status: "known", value: 35 },
    heightCm: { status: "known", value: 190 },
    weightKg: { status: "known", value: 110 },
    physiologicalSex: { status: "known", value: "male" },
    activityCategory: { status: "known", value: "active" },
  });
  assert.deepEqual(input, {
    ageYears: 35,
    physiologicalSex: "male",
    activityCategory: "active",
  });
});

test("Profile labels the Bulgarian figure as non-personalized context", () => {
  const source = fs.readFileSync(new URL("../src/components/ProfileView.tsx", import.meta.url), "utf8");
  assert.match(source, /Bulgarian population reference/);
  assert.match(source, /It is not personalized and is not a target/);
});
