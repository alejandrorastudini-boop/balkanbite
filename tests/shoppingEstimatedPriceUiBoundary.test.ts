import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/ShoppingView.tsx", import.meta.url),
  "utf8",
);

test("shopping populated prices remain explicitly estimated in every supported language", () => {
  assert.match(source, /"Subtotal estimado"/);
  assert.match(source, /"Прогнозна междинна сума"/);
  assert.match(source, /"Estimated subtotal"/);

  assert.doesNotMatch(source, /Subtotal con precios conocidos/);
  assert.doesNotMatch(source, /Междинна сума с известни цени/);
  assert.doesNotMatch(source, /Known-price subtotal/);
});

test("shopping numeric estimates render with an approximation marker", () => {
  assert.match(
    source,
    /estimatedPriceSubtotalLabel}: ~€\$\{estimatedSubtotalEUR\.toFixed\(2\)}/,
  );
  assert.match(source, /~€\$\{itemPriceEUR\.toFixed\(2\)}/);
});

test("shopping price input preserves empty string state until submit validation", () => {
  assert.match(source, /useState<string>\(""\)/);
  assert.match(source, /setEstimatedCost\(e\.target\.value\)/);
  assert.doesNotMatch(source, /setEstimatedCost\(Number\(e\.target\.value\)\)/);
});

test("missing shopping prices remain explicitly unknown", () => {
  assert.match(source, /"precios desconocidos"/);
  assert.match(source, /"неизвестни цени"/);
  assert.match(source, /"unknown prices"/);
});