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
    // 8 digits without an explicit symbology are ambiguous: UPC-E and
    // EAN-8 may BOTH satisfy an EAN-8 checksum but name different goods.
    // Never guess an EAN-8 or silently expand a UPC-E.
    const validValues = Array.from(new Set(
      candidates.map((entry) => {
        if (entry.format === "upc_e") {
          return expandValidUpcEToUpcA(entry.rawValue);
        }
        // Explicit browser symbologies must agree with the digit count.
        // If they contradict, request human correction, never reinterpret.
        if (entry.format === "ean_8" && entry.rawValue.length !== 8) return null;
        if (entry.format === "ean_13" && entry.rawValue.length !== 13) return null;
        if (entry.format === "upc_a" && entry.rawValue.length !== 12) return null;
        if (entry.rawValue.length === 8 && entry.format !== "ean_8") return null;
        if (entry.format !== undefined &&
            entry.format !== "unknown" &&
            entry.format !== "ean_8" &&
            entry.format !== "ean_13" &&
            entry.format !== "upc_a") return null;
        return normalizeValidRetailBarcode(entry.rawValue);
      }).filter((code): code is string => code !== null),
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
