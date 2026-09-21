import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync(
  new URL("../src/components/ScanModal.tsx", import.meta.url),
  "utf8",
);
const candidateSource = readFileSync(
  new URL("../src/utils/safeScanCandidate.ts", import.meta.url),
  "utf8",
);
const confirmationSource = readFileSync(
  new URL("../src/utils/confirmedScanCandidate.ts", import.meta.url),
  "utf8",
);

test("scanner copy makes row selection an explicit name/category confirmation", () => {
  assert.match(
    modalSource,
    /selecting the row explicitly confirms the displayed name and category for pantry persistence/,
  );
  assert.match(
    modalSource,
    /al seleccionar la fila, confirmas explícitamente el nombre y la categoría/,
  );
  assert.match(
    modalSource,
    /когато изберете реда, изрично потвърждавате показаните име и категория/,
  );
});

test("scanner copy states that cost and expiry suggestions are not saved", () => {
  assert.match(
    modalSource,
    /Cost and expiry remain suggestions only and are not saved/,
  );
  assert.match(
    modalSource,
    /El coste y la caducidad siguen siendo solo sugerencias y no se guardan/,
  );
});

test("row selection remains gated behind confirmed quantity and unit", () => {
  const toggleStart = modalSource.indexOf("const handleToggleItem");
  const toggleEnd = modalSource.indexOf("const updateRequiredField", toggleStart);
  const block = modalSource.slice(toggleStart, toggleEnd);

  assert.match(
    block,
    /if \(!item\.selected && !isScannedItemConfirmed\(item\)\)/,
  );
  assert.match(block, /selected: !item\.selected/);
});

test("pantry save requires both row selection and confirmed amount fields", () => {
  const saveStart = modalSource.indexOf("const handleSaveToPantry");
  const saveEnd = modalSource.indexOf("const handleResetModal", saveStart);
  const block = modalSource.slice(saveStart, saveEnd);

  assert.match(
    block,
    /item\.selected && isScannedItemConfirmed\(item\)/,
  );
  assert.match(block, /selected\.map\(toPantryPayload\)/);
});

test("price and expiry still cannot cross the pantry payload boundary", () => {
  const payloadStart = candidateSource.indexOf("export function toPantryPayload");
  const block = candidateSource.slice(payloadStart);

  assert.match(block, /name: candidate\.name\.trim\(\)/);
  assert.match(block, /category: candidate\.category/);
  assert.doesNotMatch(block, /expiryDaysLeft:/);
  assert.doesNotMatch(block, /estimatedCostEUR:/);
  assert.doesNotMatch(block, /approximateCostEUR:/);
});

test("amount confirmation helper documents selection as the separate identity gate", () => {
  assert.match(
    confirmationSource,
    /row can become selectable/,
  );
  assert.match(
    confirmationSource,
    /row\s+selection separately confirms the displayed product identity\/category/,
  );
});
