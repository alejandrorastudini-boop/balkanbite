import { normalizeValidRetailBarcode } from "./retailBarcode";

export type LocalBarcodeDetectionResult =
  | { status: "detected"; rawValue: string }
  | { status: "unverified"; rawValue: string }
  | { status: "multiple"; rawValues: string[] }
  | { status: "not_found" }
  | { status: "unsupported" }
  | { status: "failed" };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: unknown }>>;
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
      .map((entry) =>
        typeof entry.rawValue === "string" ? entry.rawValue.trim() : "",
      )
      .filter(Boolean);
    // A photo may contain more than one genuine retail code. Never guess
    // which product the user intended. Duplicate readings of one code are
    // not ambiguous; distinct checksum-valid identities require review.
    const validValues = Array.from(new Set(
      candidates.map(normalizeValidRetailBarcode)
        .filter((code): code is string => code !== null),
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
      ? { status: "unverified", rawValue: candidates[0] }
      : { status: "not_found" };
  } catch {
    return { status: "failed" };
  } finally {
    bitmap?.close();
  }
}
