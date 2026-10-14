import { expandValidUpcEToUpcA, normalizeValidRetailBarcode } from "./retailBarcode";

export type LocalBarcodeDetectionResult =
  | { status: "detected"; rawValue: string }
  | { status: "unverified"; rawValue: string }
  | { status: "multiple"; rawValues: string[] }
  | { status: "not_found" }
  | { status: "unsupported" }
  | { status: "failed" };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: unknown; format?: unknown }>>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

/**
 * Progressive enhancement for camera/image barcode capture.
 * Detection stays on-device. Product metadata is still fetched through the
 * existing barcode lookup and remains a review candidate.
 */
export async function detectBarcodeFromImageFile(
  file: File,
): Promise<LocalBarcodeDetectionResult> {
  const Detector = (globalThis as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }).BarcodeDetector;

  if (!Detector || typeof createImageBitmap !== "function") {
    return { status: "unsupported" };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const detector = new Detector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
    });
    const detections = await detector.detect(bitmap);
    const candidates = detections
      .map((entry) => ({
        rawValue: typeof entry.rawValue === "string" ? entry.rawValue.trim() : "",
        format: entry.format,
      }))
      .filter((entry) => Boolean(entry.rawValue));
    // Format matters: an 8-digit UPC-E is NOT an 8-digit EAN-8. Only the
    // detector's explicit format authorizes GS1 zero-expansion to UPC-A.
    // Unknown format stays in the legacy GTIN-only validation path.
    const validValues = Array.from(new Set(
      candidates.map((entry) =>
        entry.format === "upc_e"
          ? expandValidUpcEToUpcA(entry.rawValue)
          : normalizeValidRetailBarcode(entry.rawValue),
      ).filter((code): code is string => code !== null),
    ));
    if (validValues.length > 1) {
      return { status: "multiple", rawValues: validValues };
    }

    // A failed checksum must never become a detected retail identity.
    // Keep the raw text for explicit manual correction without a lookup.
    if (validValues.length === 1) {
      return { status: "detected", rawValue: validValues[0] };
    }
    return candidates[0]
      ? { status: "unverified", rawValue: candidates[0].rawValue }
      : { status: "not_found" };
  } catch {
    return { status: "failed" };
  } finally {
    bitmap?.close();
  }
}
