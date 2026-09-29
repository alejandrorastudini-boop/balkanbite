import { doc, runTransaction, type Firestore } from "firebase/firestore";
import type { PantryItem, PantryPurchaseRecord } from "../types";
import { getScopedDocumentId } from "./cloudCollectionSync";
import { isSafeInventoryLogicalId, isSafeInventoryProvenanceId } from "./inventoryIdentity";

export type InventoryCreationOutcome =
  | { outcome: "created"; itemIds: string[] }
  | { outcome: "needs-review"; reason: "invalid-request" | "invalid-item" | "duplicate-stock" };

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const categories = new Set(["Produce","Dairy","Meat/Fish","Pantry/Grains","Spices","Other"]);
const purchaseSources = new Set(["pantry_legacy","shopping_list","confirmed_reconciliation"]);

function validPurchase(row: PantryPurchaseRecord): boolean {
  return Boolean(row && isSafeInventoryProvenanceId(row.sourceId) && purchaseSources.has(row.source) &&
    typeof row.name === "string" && row.name.trim() && positive(row.quantity) &&
    typeof row.unit === "string" && row.unit.trim() &&
    typeof row.acquiredAt === "string" && row.acquiredAt.trim() &&
    (row.estimatedCostEUR === undefined || nonNegative(row.estimatedCostEUR)) &&
    (row.expiryDaysLeft === undefined || nonNegative(row.expiryDaysLeft)));
}

function serializeItem(item: PantryItem, userId: string): Record<string, unknown> | null {
  if (!item || !isSafeInventoryLogicalId(item.id) || typeof item.name !== "string" || !item.name.trim() ||
      !positive(item.quantity) || typeof item.unit !== "string" || !item.unit.trim() ||
      !categories.has(item.category) || typeof item.addedAt !== "string" || !item.addedAt.trim() ||
      (item.expiryDaysLeft !== undefined && !nonNegative(item.expiryDaysLeft)) ||
      (item.estimatedCostEUR !== undefined && item.estimatedCostEUR !== null &&
        !nonNegative(item.estimatedCostEUR)) ||
      (item.purchaseHistory !== undefined &&
        (!Array.isArray(item.purchaseHistory) || item.purchaseHistory.some(row => !validPurchase(row))))) {
    return null;
  }

  const out: Record<string, unknown> = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    addedAt: item.addedAt,
    userId,
    cookRevision: 0,
    _deleted: false,
    deletedAt: null,
  };
  if (item.nameBg !== undefined) out.nameBg = item.nameBg;
  if (item.nameEs !== undefined) out.nameEs = item.nameEs;
  if (item.expiryDaysLeft !== undefined) out.expiryDaysLeft = item.expiryDaysLeft;
  if (item.estimatedCostEUR !== undefined) out.estimatedCostEUR = item.estimatedCostEUR;
  if (item.expiryIsPartial !== undefined) out.expiryIsPartial = item.expiryIsPartial;
  if (item.purchaseHistory !== undefined) {
    out.purchaseHistory = item.purchaseHistory.map(row => {
      const purchase: Record<string, unknown> = {
        sourceId: row.sourceId,
        source: row.source,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        acquiredAt: row.acquiredAt,
      };
      if (row.estimatedCostEUR !== undefined) purchase.estimatedCostEUR = row.estimatedCostEUR;
      if (row.expiryDaysLeft !== undefined) purchase.expiryDaysLeft = row.expiryDaysLeft;
      return purchase;
    });
  }
  return out;
}

/**
 * Atomically creates only genuinely new owner-scoped pantry documents.
 * Existing inventory rows are never rewritten. This is intentionally separate
 * from edit/cook transactions so adding stock cannot resend versioned lots.
 */
export async function persistNewInventoryItems(
  db: Firestore,
  userId: string,
  items: readonly PantryItem[],
): Promise<InventoryCreationOutcome> {
  if (!safeUid(userId) || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const ids = new Set<string>();
  const serialized: { item: PantryItem; data: Record<string, unknown> }[] = [];
  for (const item of items) {
    if (!isSafeInventoryLogicalId(item?.id) || ids.has(item.id)) {
      return { outcome: "needs-review", reason: "invalid-item" };
    }
    ids.add(item.id);
    const data = serializeItem(item, userId);
    if (!data) return { outcome: "needs-review", reason: "invalid-item" };
    serialized.push({ item, data });
  }

  return runTransaction(db, async tx => {
    const refs = serialized.map(({ item }) =>
      doc(db, "inventory", getScopedDocumentId(userId, item.id)));
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));
    if (snapshots.some(snapshot => snapshot.exists())) {
      return { outcome: "needs-review" as const, reason: "duplicate-stock" as const };
    }
    serialized.forEach(({ data }, index) => tx.set(refs[index], data));
    return { outcome: "created" as const, itemIds: serialized.map(({ item }) => item.id) };
  }, { maxAttempts: 5 });
}
