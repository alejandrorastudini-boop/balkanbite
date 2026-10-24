# #459 — stale guest shopping checkbox/delete/clear must not erase newer rows (2026-10-23)

## Base
Functional Draft #453 `c30156c895b93d633d3e05c992b9eb3528d2010a` already has exact single-key verified readback for manual shopping add, purchase checkbox, delete and clear. QA `runTwoTabStaleShoppingAdd` covers a stale **addition**; the more destructive paths lacked direct multi-tab browser regression.

## Scenario
Real local Chromium, four guest tabs with the same initial 1 kg QA Flour list. The first tab adds 2 kg QA Apples, verified in localStorage. Three stale tabs then separately attempt to **mark purchased**, **delete** and **clear the entire list** based on an older one-row React snapshot. Each must fail closed and preserve the complete newer raw shopping list without changing user-confirmed quantities. The clear dialog stays open on failure. A stale tab reloads, marks only the original row as purchased and checks both products remain intact with correct purchase confirmation, no pantry/progression events, and persistence after reload.

## Limitations
This proves sequential stale-snapshot protection under two or more simultaneous tabs; there is still **no atomic compare-and-set** in localStorage. A truly concurrent interleaving between the second prewrite comparison and `setItem`, cross-tab crash recovery, hosted Firebase, physical Android and nutrition/health risk remain **NOT VERIFIED**. Issue #459 stays OPEN.

## Gate
Test-only and QA docs. Require lint/test/build and all Chromium scenarios plus Firestore emulator at the exact QA HEAD before expected-SHA non-force fast-forward to Draft #453. Never merge QA PR into main, deploy Production or use paid browser services.
