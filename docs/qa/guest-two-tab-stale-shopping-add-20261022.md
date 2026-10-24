# #459 — two-tab stale guest shopping addition (2026-10-22)

## Baseline
Functional Draft #453 `8e03347407da7d55ee8bb45b9c483e215ff92204`. The shopping-add helper already refuses incomplete and mismatched React/cache source data, but there was no direct local browser E2E exercising **two simultaneously open guest tabs adding different manual shopping items**.

## Scoped QA
New `runTwoTabStaleShoppingAdd` opens real local App in two Chromium pages sharing guest storage, with one synthetic confirmed **shopping-list entry only** (no purchased stock or prices). Tab A adds 2 kg QA Apples and exact storage readback is captured; stale Tab B attempts to add 500 g QA Beans from its older in-memory list, must show a failed-save warning and preserve entered form data without altering any byte of Tab A's saved list. After Tab B reloads its authoritative list, its reattempt must persist all three rows, exactly once, with amounts/units and without confirmed-purchase flags or fabricated prices. After final reload, progression must still be empty.

This checks a *specific sequential stale-snapshot collision*; it does **not** close #459 for true concurrent writes in the small compare/write window. localStorage has no cross-tab CAS. No auth/hosted Firebase or physical Android involved.

## Gates
QA exact-SHA CI lint/tests/build, six browser harnesses and offline Firestore Emulator SUCCESS before expected SHA non-force FF to functional Draft #453. No main merge or Production deployment, no external APIs or paid services.
