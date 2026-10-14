import { normalizeValidRetailBarcode } from "./retailBarcode";

export type LocalBarcodeDetectionResult =
  | { status: "detected"; rawValue: string }
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
    // A photo can contain multiple detections. Prefer a valid retail
    // identity instead of discarding it because noisy OCR came first.
    // This is still only a lookup proposal, never confirmed stock.
    const rawValue =
      candidates.find((candidate) => normalizeValidRetailBarcode(candidate) !== null) ??
      candidates[0];

    return rawValue
      ? { status: "detected", rawValue }
      : { status: "not_found" };
  } catch {
    return { status: "failed" };
  } finally {
    bitmap?.close();
  }
}
