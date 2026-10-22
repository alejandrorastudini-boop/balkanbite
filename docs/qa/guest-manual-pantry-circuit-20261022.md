# Guest loop extension: real manual pantry entry before cooking (2026-10-22)

## Baseline
Functional Draft #453 `40e35365b29d69801069e4af95c538be48e92ee6` passed the full local guest cycle from **previously recorded** 150 g rice and planned lunch, via cook, shortage, confirmed purchase, replenishment and reload. This left initial stock capture untested within that same session.

## Bounded extension
Alter the integrated browser scenario to start with an **empty** `balkanbite_pantry`, a previously recorded synthetic QA recipe and planned meal, and create 150 g QA Rice using the real pantry form (name, amount, unit, category; no price or expiry). Assert exact stored quantity, absence of invented acquisition cost and preservation of at least one user-planned meal reference. Then complete the same cooking/shortage/list/confirmed purchase/restocking/reload journey, checking no duplication and no stranded guest intents.

This is a **guest local Chromium E2E**, not hosted Firebase, physical Android or photo/receipt/voice E2E. The recipe and initial plan are seeded as controlled fixtures (not user-generated within this scenario). Any lost or unexpectedly replaced planned meal after manual pantry add is a product question to diagnose; do not weaken assertions without evidence.

## Gate
Exact SHA lint/unit/build/all six Chromium acceptance scenarios + offline Firestore emulator required. QA-only, no main merge, production deployment, external or paid services. #457 and #459 remain open pending hosted and full crash/multi-tab QA.
