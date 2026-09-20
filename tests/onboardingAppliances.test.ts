import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/OnboardingModal.tsx", import.meta.url),
  "utf8",
);

test("onboarding starts with no kitchen appliances selected", () => {
  assert.match(
    source,
    /const \[selectedAppliances, setSelectedAppliances\] = useState<string\[]>\(\[\]\);/
  );
  assert.doesNotMatch(
    source,
    /useState<string\[]>\(\["Airfryer",\s*"Horno",\s*"Vitro"\]\)/
  );
});

test("confirmed appliance selections are still persisted through onboarding completion", () => {
  assert.match(source, /appliances:\s*selectedAppliances/);
  assert.match(source, /toggleAppliance/);
});


test("blank onboarding name is omitted instead of written as undefined", () => {
  assert.match(source, /const trimmedName = name\.trim\(\)/);
  assert.match(source, /\.\.\.\(trimmedName \? \{ name: trimmedName \} : \{\}\)/);
  assert.doesNotMatch(source, /name:\s*name\.trim\(\)\s*\|\|\s*undefined/);
});


test("optional body metrics have no default values and BMI is derived, not stored", () => {
  assert.match(source, /const \[heightInput, setHeightInput\] = useState\(""\)/);
  assert.match(source, /const \[weightInput, setWeightInput\] = useState\(""\)/);
  assert.match(source, /formatBmi\(heightCm, weightKg\)/);
  assert.match(source, /heightCm !== undefined \? \{ heightCm \} : \{\}/);
  assert.match(source, /weightKg !== undefined \? \{ weightKg \} : \{\}/);
  assert.doesNotMatch(source, /bmi:\s*bmiDisplay/);
});
