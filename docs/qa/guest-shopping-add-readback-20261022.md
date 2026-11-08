# Guest manual shopping add — verified storage before success (2026-10-22)

## Code finding / baseline
Functional Draft #453 `09132c8ff0afff8cf3e780f330c780d9578fa4cb` had an optimistic guest `handleAddShoppingItem`: React accepted new user-entered products before the shopping key write was confirmed. The manual entry form already preserves fields on `false`, but this path returned `true` even after silently lost storage.

## Change
`commitVerifiedGuestShoppingAdd` checks complete, nonfiltered shopping rows, valid unique IDs, no pending guest journal, exact React cache echo, stable raw key, candidate explicit quantity and unchecked/no-purchase-confirmation origin, then exact serialized readback before success. Missing shopping key with genuinely empty displayed list is accepted; malformed historic bytes are never rewritten. The shopping UI remains open with entered fields on failure. Guest consistency warning is raised. Signed-in Firestore create remains unchanged.

No conversion of checklist entries to purchases or pantry changes; no inferred quantities, categories, prices or diet claims. LocalStorage readback is not atomic CAS across tabs; larger issue #459 remains OPEN.

## QA
`tests/guestShoppingAddCommit.test.ts`: success including new guest, data integrity, duplicate/stale, malformed, pending WAL, silent/throwing write, invalid candidate and wiring.
`qa/runtime/guest-pantry-recovery.mjs`: real browser guest form; silently dropped write must preserve form and prior cache; restore storage, resubmit, reload and verify durable addition.
Require same SHA general CI with all six Chromium harnesses plus Firestore Emulator before expected-SHA/non-force FF to Draft #453; close temporary PR without merge, no main/Production/paid APIs.
