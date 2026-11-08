# Issue #459 — proactive stale guest shopping warning across tabs

Date: 2026-10-24. Base: Draft #453 HEAD `1e4f2fe5d7da708eae62d599c267fd2e606233fd`.

## Problem and user value
Sequential two-tab Chromium regression tests already proved that a second tab's stale manual shopping add/toggle/delete/clear fails on source mismatch. However the stale tab did not warn until the user tried an action; its in-memory shopping could appear current although another tab had already saved a different complete shopping list.

## Minimal change
- On guest workspace only (not authenticated/hosted), listen for browser `storage` events on `balkanbite_shopping`; when the new raw value differs from current visible React shopping snapshot, latch `guestCrossTabShoppingStale`.
- Show a specific BG/ES/EN warning proactively to reload/review. The latch blocks shopping-dependent edits and shopping facts, **but does not invalidate independently verified read-only pantry and meal-plan facts**.
- Existing guest shopping hydration writer and managed-shortage recovery refuse writes when the new latch is active, even if unrelated shopping success clears an older recovery flag.
- No automatic merge, import, restore, or overwrite on storage events; no fetched data or background services.

## QA
Extend the **real local Chromium two-tab** stale manual add test: original tab saves an added item; the idle stale tab must already show a warning *before* any attempted edit, preserve original saved bytes and not invent a React item; the originating tab does not show a warning for its own write; stale edit still fails; reload/real retry still works. Add wiring assertions for latch/cleanup/hydration guard.

## Explicit limitations
This is a per-tab visible warning and fail-closed extension. It does **not** supply atomic cross-tab compare-and-swap in localStorage, protect a simultaneous narrow prewrite interleaving, guarantee recovery after tab/browser crash, or prove real Android/Firebase hosted E2E. #459 remains OPEN.

Gate: exact QA branch CI lint/tests/build, six Chromium harnesses, Firestore Emulator; then non-force expected SHA fast-forward to Draft #453 and close QA PR without merging main. Zero deployments, paid tools or data uploads.

## Regression found and corrected
Initial QA code passed typechecking after positioning the storage listener below the reset state, but Chromium `runChefWorkspaceFacts` failed: a corrupted shopping source in another tab incorrectly suppressed otherwise verified pantry/menu shortage answers. The corrected gate splits `guestShoppingReviewRequired` (stale shopping source) from `guestShoppingConsistencyProblem` (existing broader derived write failure). The existing Chef independence browser test remains active and must pass unmodified; no loosening of its expected facts.
