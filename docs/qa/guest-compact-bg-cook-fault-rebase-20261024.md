# Compact Bulgarian loop + guest cook derived-fault recovery — 2026-10-24

## Source checkpoint
Rebased as a fresh non-destructive QA branch from functional Draft #453 at `08c2a19f2a342c0f4042f9e547588a31320eb293`. The older QA PR #507 (`5e0e5ede`) and #508 (`79919d8d`) diverged from the functional branch while their general CI runs were cancelled, so they MUST NOT be merged or fast-forwarded independently. This microhito transplants only their two narrow browser acceptance additions onto the current authoritative code, without overwriting new guest export, privacy or multi-tab changes.

## Coverage
1. Rerun the entire manually entered guest pantry → recipe/cook → shortage → checked purchase → pantry restock → reload circuit in Bulgarian with a 320 x 844 touch-emulated Chromium viewport. Existing desktop EN and BG 390 px coverage is retained, including horizontal bounds checks for essential controls.
2. Inject silent writes lost specifically for `balkanbite_recipes` and `balkanbite_progression` after real UI cook intent. Test already checks recoverable pending intent, no premature progression event, exact 150 g → 50 g decrement, idempotent reload with exactly one event and unchanged unrelated shopping. Existing mealplan/shopping fault variants stay in the harness.

## Boundaries and gates
These are real **local Chromium** QA paths with synthetic foods, not hosted Firebase E2E, physical Android or guaranteed localStorage cross-tab CAS. They add no app production logic and cannot close issue #459 or MVP gate #457 alone.

Require exact QA commit general GitHub CI (tests + lint + build + all six Chromium harnesses), Firestore Emulator SUCCESS and diff inspection before non-force expected-SHA fast-forward into functional Draft #453. Close any superseded QA PR without merge to main; do not deploy, incur paid browsing or mutate hosted user data.