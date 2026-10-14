import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { detectBarcodeFromImageFile as detect } from "../src/utils/localBarcodeDetection";

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

test("photo with noisy and valid detections prioritizes checksum-valid retail code", async () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  const originalDetector = Object.getOwnPropertyDescriptor(globalThis, "BarcodeDetector");
  let closed = 0;
  let detections: Array<{ rawValue?: unknown }> = [
    { rawValue: "barcode-not-readable" },
    { rawValue: "4006381333931" },
    { rawValue: "4006381333931" },
  ];

  try {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: async () => ({ close: () => { closed += 1; } }),
    });
    Object.defineProperty(globalThis, "BarcodeDetector", {
      configurable: true,
      value: class {
        async detect() { return detections; }
      },
    });

    assert.deepEqual(
      await detect({} as File),
      { status: "detected", rawValue: "4006381333931" },
    );
    assert.equal(closed, 1);

    // Distinct valid identities must never silently select the first product.
    detections = [
      { rawValue: "not-a-gtin" },
      { rawValue: "4006381333931" },
      { rawValue: "96385074" },
      { rawValue: "4006381333931" },
    ];
    assert.deepEqual(
      await detect({} as File),
      { status: "multiple", rawValues: ["4006381333931", "96385074"] },
    );
    assert.equal(closed, 2);

    // The original untrusted raw value stays visible for manual correction
    // if no detection passes checksum; no candidate is silently invented.
    detections = [{ rawValue: "invalid-first" }, { rawValue: "bad-second" }];
    assert.deepEqual(
      await detect({} as File),
      { status: "unverified", rawValue: "invalid-first" },
    );
    assert.equal(closed, 3);

    detections = [];
    assert.deepEqual(await detect({} as File), { status: "not_found" });
    assert.equal(closed, 4);
  } finally {
    if (originalBitmap) {
      Object.defineProperty(globalThis, "createImageBitmap", originalBitmap);
    } else {
      Reflect.deleteProperty(globalThis, "createImageBitmap");
    }
    if (originalDetector) {
      Object.defineProperty(globalThis, "BarcodeDetector", originalDetector);
    } else {
      Reflect.deleteProperty(globalThis, "BarcodeDetector");
    }
  }
});

test("invalid read requires manual correction, not an automatic product lookup", () => {
  assert.match(source, /detection\\.status === "unverified"/);
  assert.match(source, /setBarcodeInput\\(detection\\.rawValue\\)/);
  assert.match(source, /failed the GS1 check digit/);
  assert.match(detector, /status: "unverified", rawValue: candidates\\[0\\]/);
});

test("ambiguous retail codes stay in local review until the user chooses one", () => {
  assert.match(source, /data-testid="barcode-multiple-review"/);
  assert.match(source, /detection\.status === "multiple"/);
  assert.match(source, /setBarcodeChoices\(detection\.rawValues\)/);
  assert.match(source, /barcodeChoices\.map\(\(code\) =>/);
  assert.match(source, /void lookupBarcode\(code\)/);
  assert.match(source, /setBarcodeChoices\(\[\]\)/);
});
