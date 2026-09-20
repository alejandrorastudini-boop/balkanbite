import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ProfileView.tsx", import.meta.url),
  "utf8",
);

test("profile exposes a dedicated HealthProfile deletion control only when health data exists", () => {
  assert.match(source, /profile\.healthProfile\s*&&/);
  assert.match(source, /profile-clear-health-data-btn/);
  assert.match(source, /onUpdateProfile\(\{ healthProfile: undefined \}\)/);
});

test("health-data deletion copy explicitly preserves unrelated account data", () => {
  assert.match(
    source,
    /Tu despensa, recetas, menú y cuenta no se borrarán\./,
  );
  assert.match(
    source,
    /Your pantry, recipes, meal plan, and account will not be deleted\./,
  );
});
