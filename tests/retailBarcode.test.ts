import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { normalizeValidRetailBarcode } from "../src/utils/retailBarcode";

test("accepts valid EAN-8, UPC-A, EAN-13 and GTIN-14 identities", () => {
  for (const code of ["96385074", "036000291452", "4006381333931", "10012345000017"]) {
    assert.equal(normalizeValidRetailBarcode(code), code);
  }
});

test("rejects malformed or checksum-invalid barcode identities", () => {
  for (const code of ["", "abc", "4006381333932", "1234567", "123456789012345"]) {
    assert.equal(normalizeValidRetailBarcode(code), null);
  }
});

test("server barcode route validates identity before Open Food Facts fetch", () => {
  const server = fs.readFileSync("server.ts", "utf8");
  assert.match(server, /normalizeValidRetailBarcode\(req\.params\.code\)/);
  assert.match(server, /reason: "invalid_barcode"/);
});
