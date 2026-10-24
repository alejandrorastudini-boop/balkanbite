# Guest clear shopping list — verified storage and single-key readback

Date 2026-10-21. QA branch from functional Draft #453 `8c4e2900441a3be96e4d36a5dc69288c784bfcbb`.

## Problem
Guest "Clear list" previously set React shopping to [] and reported success before the localStorage effect finished. If the write failed, the UI falsely said the entire list was empty while the persisted checklist still contained its original rows. Bulk removal is a higher-risk variant of issue #459.

## Fix
- Reuse `guestShoppingDeleteCommit.ts` single-key validated readback boundary for bulk clear; no new storage schema or cross-module transaction.
- Require no pending WAL, entire valid unique shopping list, exact visible state, unchanged raw key before write, and write/readback equality after.
- Unknown historical rows stay untouched. An absent key with visible empty list is a no-op. Failed mutations keep the confirmation modal open; existing recovery warning blocks pantry-derived authority.
- Signed-in clear continues using the Firestore mutation. Clearing a shopping checklist does not modify pantry, buy products, infer consumption or change prices.
- localStorage remains non-atomic across tabs; this microhito does NOT close issue #459.

## QA gates
`tests/guestShoppingClearCommit.test.ts`: complete, duplicate, stale, invalid, journal, silent/throwing writes, wiring. Chromium local `qa/runtime/guest-pantry-recovery.mjs`: real "Clear" dialog, silently lost write, retained list and dialog, then retry/reload with verified empty list.
Exact-SHA QA CI + Chromium six scenarios + offline Firestore Emulator required before expected-SHA FF to Draft #453; no main merge, production or costs.
