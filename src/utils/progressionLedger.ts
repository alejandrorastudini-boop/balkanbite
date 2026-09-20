import type { PantryConsumptionResult } from "./pantryConsumption";

export type ProgressionEventType =
  | "confirmed_purchase_applied"
  | "recipe_cook_inventory_applied";

export type ProgressionEvidence = "deterministic_state_transition";

export interface ProgressionEventV1 {
  version: 1;
  eventId: string;
  type: ProgressionEventType;
  occurredAt: string;
  evidence: ProgressionEvidence;
  /**
   * Count of deterministic state-transition records behind this event.
   * The ledger deliberately stores no food names, health data, nutrition
   * values, monetary values or arbitrary metadata.
   */
  evidenceCount: number;
}

export type ProgressionLedgerV1 = ProgressionEventV1[];

export interface ProgressionAppendResult {
  ledger: ProgressionLedgerV1;
  addedEventIds: string[];
  rejectedEventIds: string[];
}

const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,180}$/;
const VALID_EVENT_TYPES = new Set<ProgressionEventType>([
  "confirmed_purchase_applied",
  "recipe_cook_inventory_applied",
]);

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

export function isValidProgressionTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    hasExplicitTimezone(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function isValidProgressionEventId(value: unknown): value is string {
  return typeof value === "string" && EVENT_ID_PATTERN.test(value);
}

export function isValidProgressionEvent(
  value: unknown,
): value is ProgressionEventV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;

  return (
    event.version === 1 &&
    typeof event.type === "string" &&
    VALID_EVENT_TYPES.has(event.type as ProgressionEventType) &&
    event.evidence === "deterministic_state_transition" &&
    isValidProgressionEventId(event.eventId) &&
    isValidProgressionTimestamp(event.occurredAt) &&
    typeof event.evidenceCount === "number" &&
    Number.isInteger(event.evidenceCount) &&
    event.evidenceCount > 0
  );
}

/**
 * Append-only, idempotent progression ledger.
 *
 * Invalid candidates cannot create progress. Repeated event IDs are no-ops,
 * including duplicates inside the same append call.
 */
export function appendProgressionEvents(
  current: readonly ProgressionEventV1[],
  candidates: readonly unknown[],
): ProgressionAppendResult {
  const safeExisting = current.filter(isValidProgressionEvent).map((event) => ({
    ...event,
  }));
  const seen = new Set(safeExisting.map((event) => event.eventId));
  const ledger = [...safeExisting];
  const addedEventIds: string[] = [];
  const rejectedEventIds: string[] = [];

  for (const candidate of candidates) {
    if (!isValidProgressionEvent(candidate)) {
      const maybeId =
        candidate && typeof candidate === "object" && !Array.isArray(candidate)
          ? (candidate as Record<string, unknown>).eventId
          : undefined;
      if (typeof maybeId === "string") rejectedEventIds.push(maybeId);
      continue;
    }

    if (seen.has(candidate.eventId)) continue;

    seen.add(candidate.eventId);
    ledger.push({ ...candidate });
    addedEventIds.push(candidate.eventId);
  }

  return { ledger, addedEventIds, rejectedEventIds };
}

export function eligibleProgressEventCount(
  ledger: readonly ProgressionEventV1[],
): number {
  return ledger.filter(isValidProgressionEvent).length;
}

export interface RecipeCookProgressEvidence {
  actionId: string;
  occurredAt: string;
  result: PantryConsumptionResult;
}

/**
 * A recipe cook becomes progression evidence only when inventory was actually
 * deducted and no unresolved ingredient prevented the deterministic transition.
 * The ledger stores only the deduction count, not ingredient or pantry names.
 */
export function buildRecipeCookProgressEvent(
  input: RecipeCookProgressEvidence,
): ProgressionEventV1 | null {
  if (
    !isValidProgressionEventId(input.actionId) ||
    !isValidProgressionTimestamp(input.occurredAt) ||
    input.result.issues.length > 0 ||
    input.result.deductions.length === 0
  ) {
    return null;
  }

  return {
    version: 1,
    eventId: `cook:${input.actionId}`,
    type: "recipe_cook_inventory_applied",
    occurredAt: input.occurredAt,
    evidence: "deterministic_state_transition",
    evidenceCount: input.result.deductions.length,
  };
}

export interface PurchaseProgressEvidence {
  occurredAt: string;
  /**
   * Must contain only source IDs for acquisitions newly applied to pantry.
   * Repeated/idempotent confirmations are intentionally excluded by the caller.
   */
  newlyAppliedSourceIds: readonly string[];
}

/**
 * Build one deduplicable event per newly applied purchase source.
 * This function does not infer whether a source changed pantry state; callers
 * must pass the explicit newly-applied subset from the purchase merge boundary.
 */
export function buildPurchaseProgressEvents(
  input: PurchaseProgressEvidence,
): ProgressionEventV1[] {
  if (!isValidProgressionTimestamp(input.occurredAt)) return [];

  const unique = Array.from(
    new Set(
      input.newlyAppliedSourceIds.filter(isValidProgressionEventId),
    ),
  );

  return unique.map((sourceId) => ({
    version: 1,
    eventId: `purchase:${sourceId}`,
    type: "confirmed_purchase_applied",
    occurredAt: input.occurredAt,
    evidence: "deterministic_state_transition",
    evidenceCount: 1,
  }));
}
