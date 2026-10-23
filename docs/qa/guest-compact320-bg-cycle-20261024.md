# Bulgaria-first compact 320px food-cycle acceptance (2026-10-24)

## Baseline
Functional Draft #453 HEAD `1d3085712b49b657250685bfa92c3353397c2daa` already has green local Chromium E2E loops in English desktop and Bulgarian 390px touch emulation. Manual initial stock (150 g synthetic QA rice), planned 100 g meal, user-confirmed cooking (50 g remaining), measured shortage, shopping confirmation, pantry restock and reload are covered. Existing two-tab stale shopping/inventory regressions are also already tested.

## New bounded QA microhito
Parameterize the existing `runGuestMealToPurchaseCircuit` mobile viewport width, **keep existing English and 390px Bulgarian runs unmodified**, and add a new `320x844` Bulgarian mobile/touch run. The same UI journey checks essential button geometry fits the actual viewport, explicitly confirmed quantities/units, stored source and reload consistency, one-and-only-one cook and purchase event and no stranded intent. Failure is a real failed acceptance until diagnosed; do not silently relax controls, use CSS zoom tricks or drop the test.

## Limitations and release gate
Emulated Chromium at 320px is **not** a physical Android device, Android WebView or screen reader certification. This checks one QA fixture path, not every recipe, all Bulgarian copy, hosted Firebase or cross-tab atomicity. #457 and #459 stay open. Require exact SHA lint/unit/build, all Chromium harnesses and Firestore emulator success, inspect the diff, then only a nonforce expected-SHA FF into Draft #453. QA PR closes without main merge, no production deployment or paid browsing.
