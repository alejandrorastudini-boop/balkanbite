export type ScanResultStatus = {
  success?: unknown;
};

/**
 * Admit scanner candidates only from an explicitly successful, non-empty result.
 * Error, unavailable, malformed, and empty responses are all authoritative no-result
 * states and therefore produce no candidates.
 */
export function admitSuccessfulScanItems<T>(
  result: ScanResultStatus | null | undefined,
  items: unknown,
): T[] {
  if (result?.success !== true || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.filter(
    (item): item is T =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
}
