import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { PantryItem, PantryPurchaseRecord, ShoppingItem } from "../types";
import {
  mergePurchasesIntoPantry,
  type PantryPurchase,
  type PurchaseMergeResult,
} from "./purchasePantryMerge";
import { getScopedDocumentId } from "./cloudCollectionSync";

export interface PurchaseBaselineItem extends PantryItem {
  cookRevision?: number;
}

export interface PurchasePantryTransactionRequest {
  userId: string;
  mutationId: string;
  baselinePantry: readonly PurchaseBaselineItem[];
  purchases: readonly PantryPurchase[];
  shoppingItemsToRemove?: readonly ShoppingItem[];
  acquiredAt: string;
}

export interface PurchasePantryExpectedChange {
  pantryItemId: string;
  quantity: number;
  unit: string;
  cookRevision: number;
  kind: "create" | "update";
}

export type PurchasePantryTransactionResult =
  | {
      outcome: "recorded" | "already-recorded" | "already-applied";
      mutationId: string;
      acceptedSourceIds: string[];
      newlyAppliedSourceIds: string[];
      rejected: PurchaseMergeResult["rejected"];
      expectedChanges: PurchasePantryExpectedChange[];
      removedShoppingItemIds: string[];
    }
  | {
      outcome: "needs-review";
      reason:
        | "invalid-request"
        | "invalid-baseline"
        | "stale-stock"
        | "stale-shopping"
        | "conflicting-replay";
      pantryItemId?: string;
      shoppingItemId?: string;
    };

interface PlannedExistingUpdate {
  before: PurchaseBaselineItem;
  after: PantryItem;
  expectedRevision: number;
}

interface PlannedCreation {
  after: PantryItem;
}

interface PurchasePlan {
  signature: string;
  merge: PurchaseMergeResult;
  updates: PlannedExistingUpdate[];
  creations: PlannedCreation[];
  expectedChanges: PurchasePantryExpectedChange[];
  shoppingItemsToRemove: ShoppingItem[];
}

const safeUid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const safeMutationId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9._-]{1,150}$/.test(value);

const safeLogicalId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 300 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const safeSourceId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 400 &&
  !/[\u0000-\u001F\u007F]/.test(value);

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const validRevision = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < Number.MAX_SAFE_INTEGER;

const categories = new Set([
  "Produce",
  "Dairy",
  "Meat/Fish",
  "Pantry/Grains",
  "Spices",
  "Other",
]);

const purchaseSources = new Set([
  "pantry_legacy",
  "shopping_list",
  "confirmed_reconciliation",
]);

const cleanOptionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

function comparableShoppingItem(item: ShoppingItem): Record<string, unknown> | null {
  if (
    !item ||
    !safeLogicalId(item.id) ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    !positive(item.quantity) ||
    typeof item.unit !== "string" ||
    !item.unit.trim() ||
    typeof item.category !== "string" ||
    typeof item.checked !== "boolean" ||
    (item.estimatedPriceEUR !== undefined && !nonNegative(item.estimatedPriceEUR)) ||
    (item.amountOrigin !== undefined &&
      !["user_entered", "ai_estimated", "deterministic_shortfall"].includes(item.amountOrigin)) ||
    (item.purchaseAmountConfirmed !== undefined &&
      typeof item.purchaseAmountConfirmed !== "boolean") ||
    (item.reason !== undefined && typeof item.reason !== "string")
  ) {
    return null;
  }
  const out: Record<string, unknown> = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    checked: item.checked,
  };
  if (item.estimatedPriceEUR !== undefined) out.estimatedPriceEUR = item.estimatedPriceEUR;
  if (item.amountOrigin !== undefined) out.amountOrigin = item.amountOrigin;
  if (item.purchaseAmountConfirmed !== undefined) {
    out.purchaseAmountConfirmed = item.purchaseAmountConfirmed;
  }
  if (item.reason !== undefined) out.reason = item.reason;
  return out;
}

function comparableRemoteShopping(data: Record<string, unknown>): Record<string, unknown> | null {
  return comparableShoppingItem({
    id: data.id,
    name: data.name,
    quantity: data.quantity,
    unit: data.unit,
    category: data.category,
    estimatedPriceEUR: data.estimatedPriceEUR,
    checked: data.checked,
    amountOrigin: data.amountOrigin,
    purchaseAmountConfirmed: data.purchaseAmountConfirmed,
    reason: data.reason,
  } as ShoppingItem);
}

function validPurchaseRecord(row: PantryPurchaseRecord): boolean {
  return Boolean(
    row &&
    safeSourceId(row.sourceId) &&
    purchaseSources.has(row.source) &&
    typeof row.name === "string" &&
    row.name.trim() &&
    positive(row.quantity) &&
    typeof row.unit === "string" &&
    row.unit.trim() &&
    typeof row.acquiredAt === "string" &&
    row.acquiredAt.trim() &&
    (row.estimatedCostEUR === undefined || nonNegative(row.estimatedCostEUR)) &&
    (row.expiryDaysLeft === undefined || nonNegative(row.expiryDaysLeft)),
  );
}

function serializePantryItem(
  item: PantryItem,
  userId: string,
  cookRevision: number,
): Record<string, unknown> | null {
  if (
    !item ||
    !safeLogicalId(item.id) ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    !positive(item.quantity) ||
    typeof item.unit !== "string" ||
    !item.unit.trim() ||
    !categories.has(item.category) ||
    typeof item.addedAt !== "string" ||
    !item.addedAt.trim() ||
    !validRevision(cookRevision) ||
    (item.expiryDaysLeft !== undefined && !nonNegative(item.expiryDaysLeft)) ||
    (item.estimatedCostEUR !== undefined &&
      item.estimatedCostEUR !== null &&
      !nonNegative(item.estimatedCostEUR)) ||
    (item.purchaseHistory !== undefined &&
      (!Array.isArray(item.purchaseHistory) ||
        item.purchaseHistory.some(row => !validPurchaseRecord(row))))
  ) {
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
    cookRevision,
    _deleted: false,
    deletedAt: null,
  };
  const nameBg = cleanOptionalText(item.nameBg);
  const nameEs = cleanOptionalText(item.nameEs);
  if (nameBg) out.nameBg = nameBg;
  if (nameEs) out.nameEs = nameEs;
  if (item.expiryDaysLeft !== undefined) out.expiryDaysLeft = item.expiryDaysLeft;
  if (item.estimatedCostEUR !== undefined) out.estimatedCostEUR = item.estimatedCostEUR;
  if (item.expiryIsPartial !== undefined) out.expiryIsPartial = item.expiryIsPartial;
  if (item.purchaseHistory !== undefined) {
    out.purchaseHistory = item.purchaseHistory.map(row => {
      const record: Record<string, unknown> = {
        sourceId: row.sourceId,
        source: row.source,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        acquiredAt: row.acquiredAt,
      };
      if (row.estimatedCostEUR !== undefined) {
        record.estimatedCostEUR = row.estimatedCostEUR;
      }
      if (row.expiryDaysLeft !== undefined) {
        record.expiryDaysLeft = row.expiryDaysLeft;
      }
      return record;
    });
  }
  return out;
}

function comparableItem(item: PantryItem): Record<string, unknown> | null {
  const serialized = serializePantryItem(item, "_comparison_", 0);
  if (!serialized) return null;
  delete serialized.userId;
  delete serialized.cookRevision;
  delete serialized._deleted;
  delete serialized.deletedAt;
  return serialized;
}

function comparableRemote(
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const item = {
    id: data.id,
    name: data.name,
    nameBg: data.nameBg,
    nameEs: data.nameEs,
    quantity: data.quantity,
    unit: data.unit,
    category: data.category,
    expiryDaysLeft: data.expiryDaysLeft,
    estimatedCostEUR: data.estimatedCostEUR,
    addedAt: data.addedAt,
    purchaseHistory: data.purchaseHistory,
    expiryIsPartial: data.expiryIsPartial,
  } as PantryItem;
  return comparableItem(item);
}

const stableJson = (value: unknown): string => JSON.stringify(value);

function validatePurchases(purchases: readonly PantryPurchase[]): boolean {
  if (!Array.isArray(purchases) || purchases.length === 0 || purchases.length > 50) {
    return false;
  }
  return purchases.every(purchase =>
    purchase &&
    safeSourceId(purchase.sourceId) &&
    purchaseSources.has(purchase.source) &&
    typeof purchase.name === "string" &&
    purchase.name.trim() &&
    positive(purchase.quantity) &&
    typeof purchase.unit === "string" &&
    purchase.unit.trim() &&
    (purchase.estimatedCostEUR === undefined || nonNegative(purchase.estimatedCostEUR)) &&
    (purchase.expiryDaysLeft === undefined || nonNegative(purchase.expiryDaysLeft))
  );
}

export function buildPurchasePantryTransactionPlan(
  request: PurchasePantryTransactionRequest,
): PurchasePlan | null {
  const {
    userId,
    mutationId,
    baselinePantry,
    purchases,
    shoppingItemsToRemove = [],
    acquiredAt,
  } = request;

  if (
    !safeUid(userId) ||
    !safeMutationId(mutationId) ||
    !Array.isArray(baselinePantry) ||
    baselinePantry.length > 300 ||
    !validatePurchases(purchases) ||
    !Array.isArray(shoppingItemsToRemove) ||
    shoppingItemsToRemove.length > 50 ||
    typeof acquiredAt !== "string" ||
    !acquiredAt.trim()
  ) {
    return null;
  }

  const shoppingById = new Map<string, ShoppingItem>();
  const purchaseSourceIds = new Set(purchases.map(item => item.sourceId));
  for (const item of shoppingItemsToRemove) {
    if (
      !item ||
      !safeLogicalId(item.id) ||
      shoppingById.has(item.id) ||
      !comparableShoppingItem(item) ||
      !purchaseSourceIds.has(`shopping:${item.id}`)
    ) {
      return null;
    }
    shoppingById.set(item.id, item);
  }

  const baselineById = new Map<string, PurchaseBaselineItem>();
  for (const item of baselinePantry) {
    if (
      !item ||
      !safeLogicalId(item.id) ||
      baselineById.has(item.id) ||
      !validRevision(item.cookRevision ?? 0) ||
      !comparableItem(item)
    ) {
      return null;
    }
    baselineById.set(item.id, item);
  }

  const merge = mergePurchasesIntoPantry(
    baselinePantry.map(item => ({ ...item })),
    purchases.map(item => ({ ...item })),
    acquiredAt,
  );

  const resultById = new Map<string, PantryItem>();
  for (const item of merge.pantry) {
    if (!safeLogicalId(item.id) || resultById.has(item.id) || !comparableItem(item)) {
      return null;
    }
    resultById.set(item.id, item);
  }

  // A purchase may add or increase stock, never remove a pre-existing lot.
  for (const id of baselineById.keys()) {
    if (!resultById.has(id)) return null;
  }

  const updates: PlannedExistingUpdate[] = [];
  const creations: PlannedCreation[] = [];
  const expectedChanges: PurchasePantryExpectedChange[] = [];

  for (const [id, after] of resultById) {
    const before = baselineById.get(id);
    if (!before) {
      const serialized = serializePantryItem(after, userId, 0);
      if (!serialized) return null;
      creations.push({ after });
      expectedChanges.push({
        pantryItemId: id,
        quantity: after.quantity,
        unit: after.unit,
        cookRevision: 0,
        kind: "create",
      });
      continue;
    }

    const beforeComparable = comparableItem(before);
    const afterComparable = comparableItem(after);
    if (!beforeComparable || !afterComparable) return null;
    if (stableJson(beforeComparable) === stableJson(afterComparable)) continue;

    // The deterministic merge must preserve identity/unit/acquisition identity.
    if (
      before.id !== after.id ||
      before.name !== after.name ||
      (before.nameBg ?? "") !== (after.nameBg ?? "") ||
      (before.nameEs ?? "") !== (after.nameEs ?? "") ||
      before.unit !== after.unit ||
      before.addedAt !== after.addedAt ||
      !positive(after.quantity) ||
      after.quantity <= before.quantity
    ) {
      return null;
    }

    const revision = before.cookRevision ?? 0;
    const serialized = serializePantryItem(after, userId, revision + 1);
    if (!serialized) return null;
    updates.push({ before, after, expectedRevision: revision });
    expectedChanges.push({
      pantryItemId: id,
      quantity: after.quantity,
      unit: after.unit,
      cookRevision: revision + 1,
      kind: "update",
    });
  }

  expectedChanges.sort((a, b) => a.pantryItemId.localeCompare(b.pantryItemId));
  const acceptedSources = new Set(merge.acceptedSourceIds);
  const acceptedShoppingRows = Array.from(shoppingById.values())
    .filter(item => acceptedSources.has(`shopping:${item.id}`))
    .sort((a, b) => a.id.localeCompare(b.id));

  const signature = stableJson({
    version: 1,
    source: "purchase",
    acquiredAt,
    purchases: purchases.map(item => ({
      sourceId: item.sourceId,
      source: item.source,
      name: item.name,
      nameBg: item.nameBg ?? null,
      nameEs: item.nameEs ?? null,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category ?? null,
      estimatedCostEUR: item.estimatedCostEUR ?? null,
      expiryDaysLeft: item.expiryDaysLeft ?? null,
    })),
    expectedChanges,
    acceptedSourceIds: merge.acceptedSourceIds,
    newlyAppliedSourceIds: merge.newlyAppliedSourceIds,
    rejected: merge.rejected,
    shoppingItemsToRemove: acceptedShoppingRows.map(item => comparableShoppingItem(item)),
  });

  return {
    signature,
    merge,
    updates,
    creations,
    expectedChanges,
    shoppingItemsToRemove: acceptedShoppingRows,
  };
}

function review(
  reason: Extract<
    PurchasePantryTransactionResult,
    { outcome: "needs-review" }
  >["reason"],
  pantryItemId?: string,
  shoppingItemId?: string,
): PurchasePantryTransactionResult {
  return {
    outcome: "needs-review",
    reason,
    ...(pantryItemId ? { pantryItemId } : {}),
    ...(shoppingItemId ? { shoppingItemId } : {}),
  };
}

export async function persistPurchasesIntoPantryAtomically(
  db: Firestore,
  request: PurchasePantryTransactionRequest,
): Promise<PurchasePantryTransactionResult> {
  const plan = buildPurchasePantryTransactionPlan(request);
  if (!plan) return review("invalid-request");

  const {
    userId,
    mutationId,
  } = request;

  if (plan.merge.newlyAppliedSourceIds.length === 0 &&
      plan.shoppingItemsToRemove.length === 0) {
    return {
      outcome: "already-applied",
      mutationId,
      acceptedSourceIds: [...plan.merge.acceptedSourceIds],
      newlyAppliedSourceIds: [],
      rejected: [...plan.merge.rejected],
      expectedChanges: [],
      removedShoppingItemIds: [],
    };
  }

  const journalRef = doc(
    db,
    "purchaseApplications",
    getScopedDocumentId(userId, mutationId),
  );
  const updates = plan.updates.map(entry => ({
    ...entry,
    ref: doc(
      db,
      "inventory",
      getScopedDocumentId(userId, entry.before.id),
    ),
  }));
  const creations = plan.creations.map(entry => ({
    ...entry,
    ref: doc(
      db,
      "inventory",
      getScopedDocumentId(userId, entry.after.id),
    ),
  }));
  const shoppingRows = plan.shoppingItemsToRemove.map(item => ({
    item,
    ref: doc(
      db,
      "shoppingList",
      getScopedDocumentId(userId, item.id),
    ),
  }));

  for (let outerAttempt = 0; outerAttempt < 3; outerAttempt++) {
    try {
      return await runTransaction(db, async tx => {
        const prior = await tx.get(journalRef);
        if (prior.exists()) {
          const data = prior.data();
          if (
            data.userId !== userId ||
            data.mutationId !== mutationId ||
            data.source !== "purchase" ||
            data.requestSignature !== plan.signature ||
            !Array.isArray(data.acceptedSourceIds) ||
            !Array.isArray(data.newlyAppliedSourceIds) ||
            !Array.isArray(data.expectedChanges) ||
            !Array.isArray(data.removedShoppingItemIds)
          ) {
            return review("conflicting-replay");
          }
          return {
            outcome: "already-recorded" as const,
            mutationId,
            acceptedSourceIds: data.acceptedSourceIds as string[],
            newlyAppliedSourceIds: data.newlyAppliedSourceIds as string[],
            rejected: plan.merge.rejected,
            expectedChanges:
              data.expectedChanges as PurchasePantryExpectedChange[],
            removedShoppingItemIds: data.removedShoppingItemIds as string[],
          };
        }

        for (const entry of updates) {
          const snapshot = await tx.get(entry.ref);
          if (!snapshot.exists()) {
            return review("stale-stock", entry.before.id);
          }
          const remote = snapshot.data();
          const remoteRevision = remote.cookRevision ?? 0;
          if (
            remote.userId !== userId ||
            remote.id !== entry.before.id ||
            remote._deleted === true ||
            !validRevision(remoteRevision) ||
            remoteRevision !== entry.expectedRevision
          ) {
            return review("stale-stock", entry.before.id);
          }
          const remoteComparable = comparableRemote(remote);
          const expectedComparable = comparableItem(entry.before);
          if (
            !remoteComparable ||
            !expectedComparable ||
            stableJson(remoteComparable) !== stableJson(expectedComparable)
          ) {
            return review("stale-stock", entry.before.id);
          }
        }

        for (const entry of creations) {
          const snapshot = await tx.get(entry.ref);
          if (snapshot.exists()) {
            return review("stale-stock", entry.after.id);
          }
        }

        const shoppingSnapshots = [];
        for (const entry of shoppingRows) {
          const snapshot = await tx.get(entry.ref);
          if (!snapshot.exists()) {
            if (plan.merge.newlyAppliedSourceIds.length > 0) {
              return review("stale-shopping", undefined, entry.item.id);
            }
            shoppingSnapshots.push({ ...entry, exists: false });
            continue;
          }
          const remote = snapshot.data();
          if (remote.userId !== userId) {
            return review("stale-shopping", undefined, entry.item.id);
          }
          const remoteComparable = comparableRemoteShopping(remote);
          const expectedComparable = comparableShoppingItem(entry.item);
          if (
            !remoteComparable ||
            !expectedComparable ||
            stableJson(remoteComparable) !== stableJson(expectedComparable)
          ) {
            return review("stale-shopping", undefined, entry.item.id);
          }
          shoppingSnapshots.push({ ...entry, exists: true });
        }

        for (const entry of updates) {
          const next = serializePantryItem(
            entry.after,
            userId,
            entry.expectedRevision + 1,
          );
          if (!next) return review("invalid-baseline", entry.after.id);
          tx.set(entry.ref, next);
        }

        for (const entry of creations) {
          const next = serializePantryItem(entry.after, userId, 0);
          if (!next) return review("invalid-baseline", entry.after.id);
          tx.set(entry.ref, next);
        }

        for (const entry of shoppingSnapshots) {
          if (entry.exists) tx.delete(entry.ref);
        }

        const removedShoppingItemIds = shoppingRows.map(entry => entry.item.id);
        tx.set(journalRef, {
          userId,
          mutationId,
          source: "purchase",
          requestSignature: plan.signature,
          acceptedSourceIds: plan.merge.acceptedSourceIds,
          newlyAppliedSourceIds: plan.merge.newlyAppliedSourceIds,
          expectedChanges: plan.expectedChanges,
          removedShoppingItemIds,
          createdAt: serverTimestamp(),
        });

        return {
          outcome: "recorded" as const,
          mutationId,
          acceptedSourceIds: [...plan.merge.acceptedSourceIds],
          newlyAppliedSourceIds: [...plan.merge.newlyAppliedSourceIds],
          rejected: [...plan.merge.rejected],
          expectedChanges: [...plan.expectedChanges],
          removedShoppingItemIds: shoppingRows.map(entry => entry.item.id),
        };
      }, { maxAttempts: 5 });
    } catch (error) {
      if (
        (error as { code?: unknown } | null)?.code !== "permission-denied" ||
        outerAttempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("Purchase pantry transaction retry exhausted");
}
