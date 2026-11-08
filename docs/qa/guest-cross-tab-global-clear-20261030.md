# #459 — external localStorage.clear() in another guest tab (2026-10-30)

## Finding
At Draft #453 `4c7daac33c11115046a2c0c88d870bd663d165b8`, guest pantry/shopping storage-event listeners rejected individual changes but ignored `StorageEvent.key === null`. Browser `localStorage.clear()` emits a global event with null key; no individual pantry/shopping events are guaranteed. Stale guest tabs could retain apparently valid quantities without a proactive warning.

## Bounded response
On a *real external localStorage clear event* in guest workspace, latch **both** existing independent pantry and shopping stale-state gates. Do not merge, restore or overwrite data in the stale React view; keep changes blocked until reload/review. Conservative global invalidation is intentional because the cleared keys are unknown. Do not change authenticated workspace or hosting.

## Verification
New unit/wiring test `tests/guestCrossTabGlobalClear.test.ts` and real local Chromium two-tab `runTwoTabExternalStorageClearBlocksGuestFacts` in existing guest recovery harness. The test seeds strictly synthetic pantry and shopping data; clears localStorage explicitly only in that isolated test browser context; expects both warnings in the OTHER tab, then attempts stale pantry increment and shopping manual add and ensures neither key is silently resurrected.

## Boundaries
This does **not recover deleted bytes**, provide atomic cross-tab CAS, protect simultaneous write races, or close issue #459/#457. No external data, hosted Firebase, Android hardware, or paid automation is involved. Require exact SHA CI (all six Chromium harnesses and emulator) before expected-SHA non-force FF into Draft #453, then close QA branch PR without merge main. Production stays untouched.
