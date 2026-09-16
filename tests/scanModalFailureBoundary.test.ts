import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(process.cwd(), "src/components/ScanModal.tsx"), "utf8");

const section = (start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing ${start} boundary`);
  assert.notEqual(endIndex, -1, `missing ${end} boundary`);
  return source.slice(startIndex, endIndex);
};

const clearCount = (value: string) => value.match(/setScannedItems\(\[\]\)/g)?.length ?? 0;

test("AI error and empty-result transitions remove every pantry candidate", () => {
  const aiScan = section("const runAiScan", "const handleBarcodeSearch");

  assert.match(aiScan, /if \(detected\.length === 0\)\s*\{\s*\/\/[^\n]*\n\s*setScannedItems\(\[\]\)/);
  assert.match(aiScan, /catch \(err\) \{[\s\S]*?setScannedItems\(\[\]\)/);
  assert.ok(
    clearCount(aiScan) >= 3,
    "AI capture must clear stale candidates before scanning and again for empty/error outcomes"
  );
});

test("barcode not-found and error transitions remove every pantry candidate", () => {
  const barcodeSearch = section("const handleBarcodeSearch", "const updateItem");

  assert.match(barcodeSearch, /if \(!product\)[\s\S]*?setScannedItems\(\[\]\)/);
  assert.match(barcodeSearch, /catch \(err\) \{[\s\S]*?setScannedItems\(\[\]\)/);
  assert.ok(
    clearCount(barcodeSearch) >= 3,
    "barcode capture must clear stale candidates before lookup and again for not-found/error outcomes"
  );
});

test("an empty failure boundary has no invokable pantry persistence path", () => {
  const addSelected = section("const handleAddSelected", "return (");

  assert.match(addSelected, /scannedItems\.filter/);
  assert.match(addSelected, /if \(itemsToAdd\.length === 0\)[\s\S]*?return;/);
  assert.match(addSelected, /onAddItems\(itemsToAdd\)/);
  assert.ok(
    addSelected.indexOf("if (itemsToAdd.length === 0)") < addSelected.indexOf("onAddItems(itemsToAdd)"),
    "the zero-candidate guard must run before pantry persistence"
  );
});
