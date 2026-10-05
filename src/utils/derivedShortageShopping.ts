import type { ShoppingItem } from "../types";
import { normalizeQuantity } from "./quantityUnits";

export type DerivedShortageCandidate = Omit<ShoppingItem, "id" | "checked">;

const PREFIX = "shortage-v1:";

const normalizeIdentity = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export function buildDerivedShortageId(
  name: string,
  unit: string,
): string | null {
  const normalized = normalizeQuantity(1, unit);
  const identity = normalizeIdentity(name);
  if (!identity || !normalized || !normalized.unit.known) return null;
  return `${PREFIX}${stableHash(`${identity}::${normalized.unit.dimension}`)}`;
}

export function isManagedDerivedShortageRow(
  item: ShoppingItem,
): boolean {
  return item.amountOrigin === "deterministic_shortfall" &&
    item.id.startsWith(PREFIX);
}

function toManagedRow(candidate: DerivedShortageCandidate): ShoppingItem | null {
  if (
    candidate.amountOrigin !== "deterministic_shortfall" ||
    candidate.purchaseAmountConfirmed !== false ||
    typeof candidate.quantity !== "number" ||
    !Number.isFinite(candidate.quantity) ||
    candidate.quantity <= 0
  ) return null;
  const id = buildDerivedShortageId(candidate.name, candidate.unit);
  if (!id) return null;
  return {
    ...candidate,
    id,
    checked: false,
    amountOrigin: "deterministic_shortfall",
    purchaseAmountConfirmed: false,
  };
}

export interface ShortageShoppingReconciliation {
  next: ShoppingItem[];
  changed: boolean;
}

/**
 * Reconciles only BalkanBite-owned deterministic shortage rows.
 * User/manual/AI/legacy advisor rows are preserved byte-for-byte.
 * Invalid or unnormalizable candidates are excluded rather than guessed.
 */
export function reconcileDerivedShortageShoppingItems(
  existing: readonly ShoppingItem[],
  candidates: readonly DerivedShortageCandidate[],
): ShortageShoppingReconciliation {
  const preserved = existing.filter(item => !isManagedDerivedShortageRow(item));
  const byId = new Map<string, ShoppingItem>();

  for (const candidate of candidates) {
    const row = toManagedRow(candidate);
    if (!row) continue;
    const prior = byId.get(row.id);
    if (!prior) {
      byId.set(row.id, row);
      continue;
    }
    const priorQuantity = normalizeQuantity(prior.quantity, prior.unit);
    const nextQuantity = normalizeQuantity(row.quantity, row.unit);
    if (
      !priorQuantity ||
      !nextQuantity ||
      priorQuantity.unit.dimension !== nextQuantity.unit.dimension
    ) continue;
    byId.set(row.id, {
      ...prior,
      quantity:
        (priorQuantity.baseQuantity + nextQuantity.baseQuantity) /
        priorQuantity.unit.factorToBase,
    });
  }

  const managed = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const next = [...preserved, ...managed];
  return {
    next,
    changed: JSON.stringify(next) !== JSON.stringify(existing),
  };
}
