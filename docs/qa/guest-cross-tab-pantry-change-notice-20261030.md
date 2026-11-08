# #459 — proactive cross-tab pantry warning, guest-only (2026-10-30)

## Existing evidence and boundary
Functional Draft #453 at `f6d91be364e2b387b968c2022098833e7a28577f` already refuses stale second-tab pantry writes through `writeGuestPantrySafely`, and Chromium `runTwoTabStaleInventory` checks 500 g -> 550 g in tab A, rejects the stale tab B edit and permits 600 g only after reload. Shopping has a proactive cross-tab warning (#459). Pantry had no warning until the second tab tried to edit, leaving its 500 g view apparently current.

## Minimal improvement
When a *different* guest document modifies `balkanbite_pantry`, the browser's `storage` event latches `guestCrossTabPantryStale` until reload, displays a BG/ES/EN warning without copying new bytes into old React state, and blocks pantry-derived claims/commands and guest pantry edit/commit paths. Independent shopping facts are not invalidated by unrelated pantry changes. Existing guest WAL and signed-in Firebase paths are unchanged. The warning is not silently cleared by unrelated successful actions.

QA expands the existing *real local Chromium two-tab* scenario: warning visible **before** any stale edit, original 550 g bytes intact, stale 500 g view visibly unchanged, attempted edit blocked, then a reload permits correct 600 g. Unit/wiring tests protect the independent gate and event listener cleanup.

## Limitations
Browser storage events do not provide atomic CAS, protect the tiny compare/write interleaving, or prove safety after crashes. A warning is not a merge, not an import and not a guarantee of recovery. Local Chromium only; hosted Firebase, physical Android and paid providers are not exercised. Issue #459 and MVP gate #457 remain open.

## Gate
Require exact QA SHA lint/tests/build + six Chromium scenarios, Firestore Emulator SUCCESS and diff review before non-force expected-SHA FF into Draft #453. No main, no Production, no spending.
