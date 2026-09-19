export interface ConfirmedShortage {
  /** Stable identifier of the shortage calculation that produced this deficit. */
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ShortageShoppingLine {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  source: "plan-shortage";
  shortageId: string;
  /** Prices stay unknown until a person supplies an observed price. */
  estimatedPriceEUR?: undefined;
}

export interface ManualShoppingLine {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  source?: "manual";
  estimatedPriceEUR?: number;
}

export type ShoppingLine = ShortageShoppingLine | ManualShoppingLine;

function isConfirmedShortage(value: ConfirmedShortage): boolean {
  return (
    typeof value.id === "string" && value.id.trim().length > 0 &&
    typeof value.name === "string" && value.name.trim().length > 0 &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0 &&
    typeof value.unit === "string" && value.unit.trim().length > 0
  );
}

function toShoppingLine(shortage: ConfirmedShortage): ShortageShoppingLine {
  const shortageId = shortage.id.trim();
  return {
    id: `shortage:${shortageId}`,
    name: shortage.name.trim(),
    quantity: shortage.quantity,
    unit: shortage.unit.trim(),
    source: "plan-shortage",
    shortageId,
    estimatedPriceEUR: undefined,
  };
}

/**
 * Reconciles derived shortage lines without altering manual shopping entries.
 * Invalid or unresolved shortages are deliberately excluded rather than guessed.
 */
export function reconcileShortageShoppingLines(
  existing: readonly ShoppingLine[],
  shortages: readonly ConfirmedShortage[],
): ShoppingLine[] {
  const manualLines = existing.filter((line) => line.source !== "plan-shortage");
  const seen = new Set<string>();
  const derivedLines: ShortageShoppingLine[] = [];

  for (const shortage of shortages) {
    if (!isConfirmedShortage(shortage)) continue;
    const shortageId = shortage.id.trim();
    if (seen.has(shortageId)) continue;
    seen.add(shortageId);
    derivedLines.push(toShoppingLine(shortage));
  }

  return [...manualLines, ...derivedLines];
}
