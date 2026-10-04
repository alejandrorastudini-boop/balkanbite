import { useEffect, useState } from "react";
import {
  localCalendarDate,
  millisecondsUntilNextLocalDay,
} from "../utils/effectiveExpiry";

/**
 * Reactive local calendar date for date-sensitive UI. One timer is scheduled
 * for the next local midnight; foreground/focus refreshes cover suspended
 * background timers and device timezone changes without polling.
 */
export function useLocalCalendarDay(): string {
  const [calendarDay, setCalendarDay] = useState(
    () => localCalendarDate() || "",
  );

  useEffect(() => {
    const refresh = () => {
      const next = localCalendarDate();
      if (next) setCalendarDay(next);
    };
    const delay = millisecondsUntilNextLocalDay();
    const timer =
      delay === null ? undefined : globalThis.setTimeout(refresh, delay + 50);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    globalThis.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer !== undefined) globalThis.clearTimeout(timer);
      globalThis.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [calendarDay]);

  return calendarDay;
}
