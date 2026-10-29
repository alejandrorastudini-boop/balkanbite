# Guest two-tab pantry change notice (2026-10-29)

## Finding / user value
On functional Draft #453 base `f6d91be364e2b387b968c2022098833e7a28577f`, two-tab Chromium already proves a stale guest pantry increment cannot replace newer source bytes. But the old tab displayed its obsolete 500 g until a user tried editing after another tab saved 550 g. The late warning can mislead pantry/shortage decisions.

## Bounded fix
When guest `storage` event changes `balkanbite_pantry` to something other than the last confirmed in-memory guest source, latch a **BG/ES/EN** warning before any user action. Lock pantry-derived authority and inventory-changing commands. Preserve all existing raw bytes and refuse implicit merge/rewrite; a fresh reload rehydrates newest data and clears the per-tab warning. Authenticated Firestore paths and independently verified meal-plan queries remain unchanged.

## Verification
Extend the real two-tab Chromium pantry test: first tab increments 500→550 g, stale tab must warn proactively and still display 500 g; first tab shows no warning; stale edit cannot rewrite 550 g; reload lets second tab increment to 600 g. Unit/wiring test verifies explicit conservative guards and distinguishes menu-only independence.
This **does not** provide cross-tab atomic CAS, solve simultaneous pre-write interleaving, or guarantee crash-safe multi-key commits. #459 remains OPEN.

Require exact QA SHA lint/tests/build/six Chromium harnesses and Firestore Emulator SUCCESS before lease-guarded fast-forward to Draft #453; close QA PR without main merge. No production/hosted writes or paid services.
