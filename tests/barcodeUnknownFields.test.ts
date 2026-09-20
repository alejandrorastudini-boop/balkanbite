import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizeScanCandidate,
  toPantryPayload,
} from "../src/utils/safeScanCandidate";
import { isConfirmedScanCandidate } from "../src/utils/confirmedScanCandidate";

const serverSource = fs.readFileSync(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

function barcodeEndpointSection(): string {
  const start = serverSource.indexOf('app.get("/api/barcode/:code"');
  const end = serverSource.indexOf("// Serve legal pages directly", start);
  assert.ok(start >= 0 && end > start, "barcode endpoint source section must exist");
  return serverSource.slice(start, end);
}

test("barcode endpoint never invents quantity, unit, expiry or a placeholder product name", () => {
  const barcodeSource = barcodeEndpointSection();

  assert.doesNotMatch(barcodeSource, /quantity:\s*1/);
  assert.doesNotMatch(barcodeSource, /unit:\s*"pcs"/);
  assert.doesNotMatch(barcodeSource, /estimatedDaysUntilExpiry/);
  assert.doesNotMatch(barcodeSource, /Producto escaneado/);
  assert.match(barcodeSource, /missing_product_name/);
});

test("barcode product naming follows requested language before generic fallbacks", () => {
  const barcodeSource = barcodeEndpointSection();

  assert.match(barcodeSource, /language === "bg"\s*\? p\.product_name_bg/);
  assert.match(barcodeSource, /language === "es"\s*\? p\.product_name_es/);
  assert.match(barcodeSource, /: p\.product_name_en/);
});

test("barcode candidate with source-known identity but unknown amount remains unsaveable", () => {
  const candidate = normalizeScanCandidate({
    name: "Кисело мляко",
    category: "Dairy",
    source: "openfoodfacts",
  });

  assert.ok(candidate);
  assert.equal(candidate?.quantity, undefined);
  assert.equal(candidate?.unit, undefined);
  assert.equal(candidate?.estimatedDaysUntilExpiry, undefined);
  assert.equal(
    isConfirmedScanCandidate(candidate!, false, false),
    false,
  );
  assert.equal(toPantryPayload(candidate!), null);
});

test("explicit user amount confirmation can unlock pantry payload without inventing expiry", () => {
  const reviewed = normalizeScanCandidate({
    name: "Кисело мляко",
    category: "Dairy",
    quantity: 2,
    unit: "cups",
  });

  assert.ok(reviewed);
  assert.equal(
    isConfirmedScanCandidate(reviewed!, true, true),
    true,
  );
  assert.deepEqual(toPantryPayload(reviewed!), {
    name: "Кисело мляко",
    category: "Dairy",
    quantity: 2,
    unit: "cups",
  });
});
