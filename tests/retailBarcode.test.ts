import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { expandValidUpcEToUpcA, normalizeValidRetailBarcode } from "../src/utils/retailBarcode";

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

test("UPC-E expands to validated UPC-A, never silently to unrelated EAN-8", () => {
  // GS1 zero-suppression test vector and representative selector branches.
  for (const [compact, upcA] of [
    ["01234558", "012345000058"], // selector 5, GS1 example
    ["01234565", "012345000065"], // selector 6
    ["03456703", "034000005673"], // selector 0
    ["03456733", "034500000673"], // selector 3
    ["03456741", "034560000071"], // selector 4
    ["03456750", "034567000050"], // selector 5
  ]) {
    assert.equal(expandValidUpcEToUpcA(compact), upcA);
    assert.equal(normalizeValidRetailBarcode(upcA), upcA);
  }

  // Even a compact code that happens to pass an EAN-8 checksum represents
  // a different identity when its *detected format* is UPC-E.
  assert.equal(normalizeValidRetailBarcode("01234558"), "01234558");
  assert.equal(expandValidUpcEToUpcA("01234558"), "012345000058");
});

test("UPC-E must include a valid number system, all digits and UPC-A checksum", () => {
  for (const invalid of [
    null, 1234558, "123455", "0123455", "21234558", "01234559",
    "03456704", "0123455A", "012345581", "",
  ]) {
    assert.equal(expandValidUpcEToUpcA(invalid), null);
  }
});
