const DAY_MS = 24 * 60 * 60 * 1000;

export type EffectiveExpiry =
  | { status: "unknown" }
  | {
      status: "known";
      expiresOn: string;
      daysRemaining: number;
      expired: boolean;
    };

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function storedCalendarDay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = Date.UTC(year, month - 1, day);
  const check = new Date(result);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

function localCalendarDayFromDate(value: Date): number | null {
  const time = value.getTime();
  if (!Number.isFinite(time)) return null;
  return Date.UTC(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
}

export function localCalendarDate(value: Date = new Date()): string | null {
  const day = localCalendarDayFromDate(value);
  return day === null ? null : isoDate(day);
}

function isoDate(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10);
}

/**
 * Ages legacy "days until expiry" evidence using calendar-day semantics.
 *
 * Existing pantry creation stores capture provenance as YYYY-MM-DD, so the
 * historical data cannot support hour-level expiry precision. A value of 0
 * means the entered expiry day is the capture day; it becomes past only on
 * the following local calendar day. The capture date and current date are interpreted as local calendar dates;
 * no hour-level precision is invented.
 */
export function deriveEffectiveExpiry(
  expiryDaysAtCapture: unknown,
  capturedAt: unknown,
  now: Date = new Date(),
): EffectiveExpiry {
  if (
    !finiteNonnegative(expiryDaysAtCapture) ||
    !Number.isInteger(expiryDaysAtCapture)
  ) {
    return { status: "unknown" };
  }

  const capturedDay = storedCalendarDay(capturedAt);
  const nowDay = localCalendarDayFromDate(now);
  if (capturedDay === null || nowDay === null) return { status: "unknown" };

  const expiresDay = capturedDay + expiryDaysAtCapture * DAY_MS;
  // Clock skew must never manufacture more shelf life than was confirmed.
  const effectiveNowDay = Math.max(nowDay, capturedDay);
  const remainingDays = Math.round((expiresDay - effectiveNowDay) / DAY_MS);
  const expired = remainingDays < 0;

  return {
    status: "known",
    expiresOn: isoDate(expiresDay),
    daysRemaining: expired ? 0 : remainingDays,
    expired,
  };
}

export interface PantryExpiryEvidence {
  expiryDaysLeft?: number;
  addedAt: string;
  expiryIsPartial?: boolean;
}

/**
 * Top-level expiry is trustworthy only while it describes one non-partial
 * stock quantity. Merged stock keeps historical provenance but not
 * authoritative remaining quantity per lot, so its top-level warning cannot
 * be presented or scored as an exact current expiry.
 */
export function derivePantryItemExpiry(
  item: PantryExpiryEvidence,
  now: Date = new Date(),
): EffectiveExpiry {
  if (item.expiryIsPartial) return { status: "unknown" };
  return deriveEffectiveExpiry(item.expiryDaysLeft, item.addedAt, now);
}


/**
 * Automatic planning/use is blocked only by trustworthy explicit expiry
 * evidence that is already past. Missing, partial, or uninterpretable evidence
 * cannot support a freshness claim, but also cannot support a hard block.
 * Partial merged expiry therefore remains visibly uncertain and is excluded
 * from exact expiry prioritization without pretending the aggregate is expired.
 */
export function pantryItemNeedsExpiryReview(
  item: PantryExpiryEvidence,
  now: Date = new Date(),
): boolean {
  if (item.expiryDaysLeft === undefined || item.expiryIsPartial) return false;
  const expiry = derivePantryItemExpiry(item, now);
  // Unknown legacy evidence cannot support a freshness claim, but it also
  // cannot support a hard automatic-use block. Only a trustworthy entered
  // date that is actually past creates that block.
  return expiry.status === "known" && expiry.expired;
}
