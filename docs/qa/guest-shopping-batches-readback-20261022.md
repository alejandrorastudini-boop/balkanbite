# Guest reviewed multi-row shopping additions — exact readback (2026-10-22)

## Baseline
Stacked QA branch from manual guest shopping add QA HEAD `9966a03b56a731e5af4066e05bf6d5c3bfb505ce`. Do not promote this branch independently until QA #497 succeeds and is advanced into functional Draft #453.

## Change
Three routes previously optimistic: deterministic shopping-advisor batch, recipe missing-ingredient additions, and Chef voice-confirmed shopping additions. A rejected silent `localStorage.setItem` could result in apparent success without persistence. Reuse one complete-list, non-filtered, ownerless guest add boundary with a batch: validated candidate row structure/unique IDs/quantities, not checked/no confirmed purchase, no pending WAL, stable raw shopping key, exact React echo, one storage write, exact readback. Advisor prepends; recipe/voice append. On failure return false to caller and retain review warning. Advisor duplicate fingerprint only records success after persistence.

The older single-item add now calls the same internal batch boundary, retaining its stricter explicit manual-origin requirement. No change to signed-in Firestore mutations. No automatic pantry inventory entries, price facts, nutritional facts or user/health data. Best-effort localStorage check is not cross-tab atomic CAS.

## Tests and release limits
`tests/guestShoppingBatchCommit.test.ts` covers two placements, invalid/duplicate rows, stale/corrupt storage, pending journals, silent failures and wiring. Local Chromium six-scenario harness must pass after QA stack; browser end-to-end coverage of every new batch source is NOT independently claimed by the unit/wiring tests. Still requires QA of actual advisor/voice UX and two tabs. No merge main, no Production or paid services.
