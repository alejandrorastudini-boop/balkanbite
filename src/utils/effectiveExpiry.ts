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

function utcCalendarDay(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;
  return Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
}

function utcCalendarDayFromDate(value: Date): number | null {
  const time = value.getTime();
  if (!Number.isFinite(time)) return null;
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
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
 * the following UTC calendar day. This matches the UTC date convention used
 * by the existing addedAt writers without inventing a capture time.
 */
export function deriveEffectiveExpiry(
  expiryDaysAtCapture: unknown,
  capturedAt: unknown,
  now: Date = new Date(),
): EffectiveExpiry {
  if (!finiteNonnegative(expiryDaysAtCapture)) return { status: "unknown" };

  const capturedDay = utcCalendarDay(capturedAt);
  const nowDay = utcCalendarDayFromDate(now);
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
