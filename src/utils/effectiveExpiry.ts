const DAY_MS = 24 * 60 * 60 * 1000;

export type EffectiveExpiry =
  | { status: "unknown" }
  | {
      status: "known";
      expiresAt: string;
      daysRemaining: number;
      expired: boolean;
    };

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Ages legacy "days until expiry" evidence from the instant at which it was
 * captured. It does not invent an expiry when either input is unknown.
 *
 * The legacy field represents elapsed 24-hour periods, not a local calendar
 * date. New schema work may later store an explicit expiry date, but this
 * helper gives existing confirmed relative data deterministic time semantics
 * without mutating persisted state on render.
 */
export function deriveEffectiveExpiry(
  expiryDaysAtCapture: unknown,
  capturedAt: unknown,
  now: Date = new Date(),
): EffectiveExpiry {
  if (!finiteNonnegative(expiryDaysAtCapture)) return { status: "unknown" };

  const capturedMs = parseInstant(capturedAt);
  const nowMs = now.getTime();
  if (capturedMs === null || !Number.isFinite(nowMs)) return { status: "unknown" };

  const expiresMs = capturedMs + expiryDaysAtCapture * DAY_MS;
  const remainingMs = expiresMs - nowMs;
  const expired = remainingMs < 0;
  const daysRemaining = expired ? 0 : Math.ceil(remainingMs / DAY_MS);

  return {
    status: "known",
    expiresAt: new Date(expiresMs).toISOString(),
    daysRemaining,
    expired,
  };
}
