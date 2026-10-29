# Guest end-to-end food circuit — single browser acceptance (2026-10-22)

## Baseline and scope
Functional Draft #453 at `bdd4f0b9b700d537b8cea4619cea191d43c6c1a9`. Previously the Chromium suite validated distinct pantry CRUD, recipe cook multi-key journal, list writes and shopping-to-pantry purchase independently. No single uninterrupted user journey proved their propagation together.

## New runtime acceptance
`runGuestMealToPurchaseCircuit` in the existing `qa/runtime/guest-pantry-recovery.mjs` opens a *real local App* guest session, seeded with synthetic **150 g QA Rice**, one recorded lunch requiring **100 g**, the recipe and empty shopping/progression. Then it:
1. Verifies recorded menu source and real recipe card.
2. Uses real cooking confirmation and checks exact pantry **50 g** plus one saved cook progression event.
3. Accepts either journal-generated recipe shortage or uses the visible recipe **Add missing** action when absent; requires explicit positive quantity in g, no purchase confirmation and no invented price.
4. Opens actual shopping UI, confirms the displayed purchased amount, and transfers through real guest purchase intent.
5. Verifies pantry total = **50 g + exactly confirmed shopping amount**, transferred row removed, one purchase event, and no outstanding cook/purchase journal.
6. Reloads browser and checks the results, recipe/menu availability and one-and-only-one cook/purchase event.

These quantities are fixed synthetic QA data. This is a **guest local-Chromium E2E** of a prepared pantry+meal plan; it is NOT real receipt/photo ingestion, Android microphone, hosted Firebase multi-account E2E, clinical nutrition safety or full purchase-to-pantry UX on an arbitrary recipe. Auto planner may legitimately refresh the stored menu, so the test checks source availability rather than assuming a fixed future plan.

## Gates
Require exact-SHA general CI (lint/build/tests plus all six Chromium scripts) and Firestore emulator SUCCESS. If failing, diagnose real source/UX problem before claiming complete or promoting. QA-only branch and Draft PR; do not merge to main or Production; issue #459 remains open.
