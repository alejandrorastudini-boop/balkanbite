# Guest shopping delete — readback before reporting removal (2026-10-21)

## Baseline / risk
Functional Draft #453 `36bcec5ba41fe422e31d3ea9e5705fa09fe537f8`. Open gate #459. Guest delete previously removed rows optimistically in React and returned success before `balkanbite_shopping` persistence effect. A silently lost storage write could erase a row from the UI although it would reappear after reload, violating shopping-list reliability.

## Bounded change
- `commitVerifiedGuestShoppingDelete` checks full unfiltered valid shopping rows, unique IDs and exact React echo, pending journal, stable raw key before write, exact readback and no silent filtering.
- No React deletion or success on missing, stale, malformed, duplicated, pending WAL, throwing or silent-failure storage. Existing UI shows error and retains the row.
- Authenticated server mutation unchanged; deleting a row does NOT prove purchase, adjust pantry or recalculate health/money.
- localStorage still does not provide atomic CAS across tabs; this is a scoped single-key guard, not full #459 closure.

## Verification
Unit/wiring: `tests/guestShoppingDeleteCommit.test.ts`. Browser runtime `qa/runtime/guest-pantry-recovery.mjs`: inject silently lost delete via real row button, verify row remains and original bytes survive; restore storage, retry successfully, reload and verify deletion.
Require exact QA SHA general CI (tests/lint/build and six Chromium harnesses) + Firestore Emulator SUCCESS before non-force FF into Draft #453; close QA PR without merging to main. Production, hosted Firebase and paid tools untouched.
