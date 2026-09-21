const LEGACY_DEMO_PANTRY_ITEM_IDS = new Set([
  "sp-1",
  "sp-2",
  "sp-3",
  "sp-4",
  "sp-5",
  "sp-6",
  "sp-7",
  "sp-8",
  "sp-9",
  "sp-10",
  "sp-11",
  "sp-12",
  "sp-13",
  "sp-14",
]);

/**
 * Historical demo pantry IDs from early BalkanBite builds.
 *
 * Keep only the identifiers needed to reject stale demo rows. Do not retain
 * fabricated food names, quantities, prices or expiry values as production
 * source data.
 */
export function isLegacyDemoPantryItemId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    LEGACY_DEMO_PANTRY_ITEM_IDS.has(value.trim())
  );
}
