import type { PantryItem } from "../types";
import type { PurchaseMergeResult } from "./purchasePantryMerge";

export interface PendingPurchaseCommitEvidence {
  userId: string;
  mutationId: string;
  acceptedSourceIds: string[];
  newlyAppliedSourceIds: string[];
  occurredAt: string;
  expected: Array<{
    pantryItemId: string;
    quantity: number;
    unit: string;
    sourceIds: string[];
  }>;
}

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());

export function buildPendingPurchaseCommitEvidence(
  userId: string,
  mutationId: string,
  occurredAt: string,
  result: PurchaseMergeResult,
): PendingPurchaseCommitEvidence | null {
  if (
    !nonBlank(userId) ||
    !nonBlank(mutationId) ||
    !nonBlank(occurredAt) ||
    !result ||
    !Array.isArray(result.pantry) ||
    !Array.isArray(result.acceptedSourceIds) ||
    !Array.isArray(result.newlyAppliedSourceIds) ||
    result.acceptedSourceIds.length === 0
  ) {
    return null;
  }

  const newly = new Set(result.newlyAppliedSourceIds);
  if (
    newly.size !== result.newlyAppliedSourceIds.length ||
    result.newlyAppliedSourceIds.some(
      sourceId => !result.acceptedSourceIds.includes(sourceId),
    )
  ) {
    return null;
  }

  const byPantryId = new Map<string, {
    pantryItemId: string;
    quantity: number;
    unit: string;
    sourceIds: string[];
  }>();

  for (const sourceId of newly) {
    if (!nonBlank(sourceId)) return null;
    const matches = result.pantry.filter(item =>
      item.purchaseHistory?.some(record => record.sourceId === sourceId),
    );
    if (matches.length !== 1) return null;
    const item = matches[0];
    if (
      !nonBlank(item.id) ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !nonBlank(item.unit)
    ) {
      return null;
    }
    const existing = byPantryId.get(item.id);
    if (existing) {
      existing.sourceIds.push(sourceId);
    } else {
      byPantryId.set(item.id, {
        pantryItemId: item.id,
        quantity: item.quantity,
        unit: item.unit,
        sourceIds: [sourceId],
      });
    }
  }

  return {
    userId,
    mutationId,
    acceptedSourceIds: [...result.acceptedSourceIds],
    newlyAppliedSourceIds: [...result.newlyAppliedSourceIds],
    occurredAt,
    expected: [...byPantryId.values()]
      .map(item => ({
        ...item,
        sourceIds: [...item.sourceIds].sort(),
      }))
      .sort((a, b) => a.pantryItemId.localeCompare(b.pantryItemId)),
  };
}

export function isPurchaseCommitVisible(
  pending: PendingPurchaseCommitEvidence,
  activeUserId: string,
  pantry: readonly PantryItem[],
): boolean {
  if (
    !pending ||
    pending.userId !== activeUserId ||
    !Array.isArray(pantry)
  ) {
    return false;
  }

  return pending.expected.every(expected => {
    const item = pantry.find(candidate => candidate.id === expected.pantryItemId);
    if (
      !item ||
      item.quantity !== expected.quantity ||
      item.unit !== expected.unit
    ) {
      return false;
    }

    const sourceIds = new Set(
      (item.purchaseHistory || []).map(record => record.sourceId),
    );
    return expected.sourceIds.every(sourceId => sourceIds.has(sourceId));
  });
}

export function arePurchaseSourcesVisible(
  acceptedSourceIds: readonly string[],
  pantry: readonly PantryItem[],
): boolean {
  if (
    !Array.isArray(acceptedSourceIds) ||
    acceptedSourceIds.length === 0 ||
    new Set(acceptedSourceIds).size !== acceptedSourceIds.length ||
    !Array.isArray(pantry)
  ) {
    return false;
  }

  return acceptedSourceIds.every(sourceId => {
    if (!nonBlank(sourceId)) return false;
    let matches = 0;
    for (const item of pantry) {
      if (
        item.purchaseHistory?.some(record => record.sourceId === sourceId)
      ) {
        matches += 1;
      }
    }
    return matches === 1;
  });
}
