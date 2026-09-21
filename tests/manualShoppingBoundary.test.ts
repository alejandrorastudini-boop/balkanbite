import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const shoppingSource = fs.readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8",
);
const appSource = fs.readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

test("manual shopping form starts without invented amount or category", () => {
  assert.match(shoppingSource, /const \[quantity, setQuantity\] = useState<string>\(""\)/);
  assert.match(shoppingSource, /const \[unit, setUnit\] = useState<string>\(""\)/);
  assert.doesNotMatch(shoppingSource, /setQuantity\(1\)/);
  assert.doesNotMatch(shoppingSource, /useState<string>\("Produce"\)/);
  assert.doesNotMatch(shoppingSource, /const \[category, setCategory\]/);
  assert.match(shoppingSource, /category: ""/);
});

test("manual shopping form requires explicit quantity and unit", () => {
  assert.match(shoppingSource, /id="manual-shopping-quantity"[\s\S]*required/);
  assert.match(shoppingSource, /id="manual-shopping-unit"[\s\S]*required/);
  assert.match(shoppingSource, /<option value="" disabled>/);
  assert.match(shoppingSource, /id="manual-shopping-submit"/);
  assert.match(shoppingSource, /hasValidManualShoppingRequiredFields\(/);
});

test("App independently rejects incomplete manual shopping additions", () => {
  const start = appSource.indexOf("const handleAddShoppingItem");
  const end = appSource.indexOf("const handleTransferToPantry", start);
  assert.ok(start >= 0 && end > start);
  const handler = appSource.slice(start, end);

  assert.match(handler, /hasValidManualShoppingRequiredFields\(item\)/);
  assert.match(handler, /return;/);
  assert.match(handler, /category:[\s\S]*item\.category\.trim\(\)[\s\S]*: ""/);
  assert.doesNotMatch(handler, /category:\s*"Produce"/);
});
