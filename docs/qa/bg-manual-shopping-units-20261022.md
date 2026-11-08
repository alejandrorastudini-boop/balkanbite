# BG manual shopping units — localized labels, preserved data (2026-10-22)

## Baseline
Draft #453 at `57e54bae3ff198c77b979d8035f15bd982469e5e`. On `ShoppingView` manual add form, BG users encountered EN labels ("Units", "Packs") and ES labels ("Kilogramos", "Gramos", "Litros") while choosing quantity units. That is a Bulgaria-first UX defect, not a reason to change any stored quantities.

## Change
Localize six displayed unit labels for Bulgarian (and consistently label EN/ES), preserving **exact canonical option values** `uds`, `kg`, `g`, `packs`, `manojos`, `l`. No conversions, inferred amounts, prices or purchases, no persistence schema changes. The old `manojos` ID continues to represent bunches even though BG renders `Връзки`.

## Tests
Static regression for all six BG label/value pairs and binding, and local real Chromium BG 390px touch guest scenario: select explicit **500 g** for synthetic QA Леща; confirm one persisted unchecked manual row with `unit="g"`, unconfirmed purchase, absent price; reload and verify byte-equivalent saved shopping rows. The existing six Chromium harnesses, lint/unit/build and Firestore Emulator are required on exact QA SHA before promotion.

No Android device, hosted Firebase, full localization certification, main merge or Production deployment. #459 and #457 remain OPEN.
