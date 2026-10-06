import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/ScanModal.tsx", "utf8");
const detector = fs.readFileSync("src/utils/localBarcodeDetection.ts", "utf8");

test("barcode camera capture is progressive enhancement with manual fallback", () => {
  assert.match(source, /data-testid="barcode-camera-input"/);
  assert.match(source, /detectBarcodeFromImageFile/);
  assert.match(source, /lookupBarcode\(detection\.rawValue\)/);
  assert.match(source, /Enter EAN barcode/);
});

test("local detector supports retail EAN and UPC families without remote image upload", () => {
  assert.match(detector, /"ean_13", "ean_8", "upc_a", "upc_e"/);
  assert.match(detector, /BarcodeDetector/);
  assert.doesNotMatch(detector, /fetch\(/);
});
