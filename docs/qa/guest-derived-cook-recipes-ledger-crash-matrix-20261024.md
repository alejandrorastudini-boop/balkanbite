# Guest derived cook — recipes and progression crash matrix (2026-10-24)

## Verified starting point
Functional Draft #453 HEAD `1d3085712b49b657250685bfa92c3353397c2daa` has successful local Chromium tests for a five-key guest recipe cook, plus silent write failures in `balkanbite_mealplan` and `balkanbite_shopping`. The **same real recipe-cooking UI** lacked equivalent injected faults for `balkanbite_recipes` and `balkanbite_progression`. Issue #459 remains OPEN.

## Test-only scope
Extend `qa/runtime/guest-pantry-recovery.mjs` to invoke the existing `runRealGuestDerivedCook` harness with those two missing keys. Each independent synthetic fault occurs **after** the cook intent is written and the canonical pantry is decremented from 150 g to 50 g. The existing scenario asserts: visible recovery warning and durable intent; no falsely successful progression while the operation is incomplete; on reload, exact recipe/pantry/menu/shopping/progression recovery; on another reload, exactly one consumption event and no second 100 g deduction, while preserving an unrelated explicitly entered shopping row.

No application logic is modified or presumed correct before this test passes. The test's current assertions for recipe and progression failure are intentionally the **same strict assertions** as the already-passing mealplan/shopping cases; do not weaken them to hide a real defect. All products, amounts and events are synthetic QA fixtures, not user nutritional facts.

## Gate and limits
Require the exact QA commit's lint, unit tests, build, all six local Chromium browser harnesses and Firestore Emulator in SUCCESS before lease-guarded non-force promotion into Draft #453. Close QA PR without merge to main. This tests sequential persisted recovery in a single browser and reload; **not** cross-tab compare-and-swap, hosted Firebase, real Android hardware or crash at every CPU instruction. No Production or paid tools.
