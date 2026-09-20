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
