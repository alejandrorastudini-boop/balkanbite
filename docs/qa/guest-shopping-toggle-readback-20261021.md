# Guest shopping purchase toggle — storage readback before success (2026-10-21)

Functional Draft baseline: `fa97bd261ad10203fd3ed1d33cfe535e1475002c`. Open #459 remains broader.

## Verified code issue
`handleToggleShoppingItem` previously toggled guest UI state and returned success immediately, relying on an asynchronous React shopping writer. A silently ignored storage write could leave a visibly purchased row that was never persisted. Since a checked row represents a user-confirmed quantity, this risks a false purchase state. The signed-in branch uses server mutation and remains unchanged.

## Scoped fix
- `commitVerifiedGuestShoppingToggle`: complete valid stored list, distinct IDs, exact visible snapshot, no pending guest WAL, stable reread, synchronous write and exact readback before success. Missing/stale/invalid sources block without rewriting unknown bytes.
- Guest App advances React state only when the helper reports `saved:true`. Failed storage sets existing guest shopping consistency warning and returns false to the shopping view.
- A successful toggle does **not** add stock to pantry; it only records the checklist mark plus confirmed displayed amount, preserving existing semantics.
- LocalStorage key equality is best-effort only; there is **no** atomic CAS across tabs. All other guest shopping mutations still require separate investigation.

## QA
`tests/guestShoppingToggleCommit.test.ts` unit tests include silent throw, stale view, malformed/duplicate IDs and WAL conflicts. Chromium local browser must inject silently dropped shopping writes via the actual checkbox and reject apparent success while preserving source bytes, then test a successful retry. Exact-SHA CI and Firestore Emulator before promotion to #453; no merge main, Production or paid services.
