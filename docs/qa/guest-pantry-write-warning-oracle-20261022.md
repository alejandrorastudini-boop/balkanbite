# Guest failed pantry write — explicit blocking alert or banner (2026-10-22)

## Reproduced CI false negative
QA #497 `9966a03b56a731e5af4066e05bf6d5c3bfb505ce` failed in the existing first Chromium `runFailedGuestQuantityWrite` test (run #39833529991), **before reaching the new manual-shopping acceptance**. The checked-in diagnostics artifact `guest-quantity-failure-throw.json` shows:
- `__qaFailedQuantityWriteAttempts=1` (injected quota error exercised);
- exact pantry bytes for 500 g preserved, visible quantity 500 g, no journal;
- a recorded blocking `alert`: “The entire operation could not be confirmed. Reload and review the data before continuing.”;
- no matching banner in that render; old test required a banner only and timed out.
This is evidence of a **test oracle mismatch**, not evidence of lost stock or successful write. It does not prove broader guest reliability.

## Minimal change
Only the Chromium oracle changes. If the precise, explicit blocking browser alert was recorded, it is sufficient warning evidence; otherwise the test continues to require one of the visible recovery/warning banners, unchanged. It still independently verifies the injected write attempt, unchanged source bytes and unchanged visible 500 g (never 550 g). No UI, runtime, persistence or production behavior changes.

## Gates
Full exact-SHA CI with all six Chromium harnesses and Firestore Emulator must be SUCCESS before fast-forwarding this QA-only change into Draft #453. No merge main, deployment or paid tools. The QA #498 combined branch `944bcef33fe1ed168a21346ea27acf5f49e5e156` did pass full CI after #497 failed; branch #497 closed as superseded without merge. Issue #459 remains open for true multi-key / multi-tab atomicity.
