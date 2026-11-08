# Bulgaria-first mobile food cycle — 390px Chromium QA (2026-10-22)

## Scope and source
Functional Draft #453 base `6fd77dc50d466bcf3f604157c0b09162f978f53e`; a real local-Chromium EN desktop path already passed manual pantry entry, recorded planned recipe, cook confirmation, shortages, exact purchase confirmation, restock and reload. This QA branch **adds a second full real UI session** in Bulgarian.

## New mobile acceptance
- Chromium emulates a touch device with `viewport: 390 x 844`, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true` and `locale: bg-BG`; app profile explicitly uses `language: bg`.
- Run the same manually created synthetic 150 g pantry → planned 100 g recipe → confirmed cook → exact 50 g remainder → shortage → checked quantity → restock → reload, with Bulgarian cooking and purchase labels.
- Ensure essential action controls (pantry add/save, cook/confirm, missing-item action when used, confirm purchase, transfer) have visible, horizontally contained clickable bounding boxes within the 390 px width after scrolling.
- Preserve exact single-use progression events, amount/units and unknown cost, prevent implicit purchases and stale journal artifacts.
- The existing English desktop full path remains an independent execution; its evidence marker is unchanged.

## Boundaries / QA gate
This is local Chromium **mobile emulation**, not real Android hardware, on-device microphone, hosted Firebase/Auth, or tested Bulgarian copy on every screen. It does not set locale-dependent diet or cost defaults. Require exact-SHA CI including lint/unit/build and six browser harnesses, plus Firestore Emulator. If it finds actual layout/copy/runtime failures, diagnose and fix in a reversible slice before promoting into functional Draft #453.

No main merge, no production deployment, no paid tooling. Public MVP gate #457 and crash gate #459 remain OPEN.
