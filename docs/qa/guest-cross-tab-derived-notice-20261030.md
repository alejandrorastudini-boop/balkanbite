# #459 — cross-tab recipe/menu/progression staleness (2026-10-30)

## Finding
Functional Draft #453 at `f3b63a295fc6d49961afe3043a7617c35c20bd18` already proactively blocks stale pantry and shopping views when another tab changes those keys, but independent recipe/meal-plan/progression localStorage keys had no corresponding `storage` listener. A stale tab could still display apparently current cooking/recipe facts, and its independent React persistence effects could attempt to write old derived snapshots.

## Bounded fix
- Guest-only, when another tab changes `balkanbite_recipes`, `balkanbite_mealplan`, or `balkanbite_progression` (or calls `localStorage.clear()`), latch `guestCrossTabDerivedStale` until reload. No automatic merge, restore or source rewrite.
- Block the three derived legacy effect writers and the automatic shopping-shortage hydration repair while stale.
- Treat pantry-dependent operations as provisional and show an explicit BG/ES/EN warning. Independently verified shopping checklist state is **not** relabelled stale merely because another tab changes a recipe.
- Existing signed-in owner-scoped Firestore mutations and journal transaction contracts unchanged.
- Real local Chromium two-tab test checks a source event for each of the three keys, warning visible before stale pantry edit, exact original pantry bytes protected, newer source bytes untouched and warning cleared only after reload. Fixtures use synthetically valid empty arrays with differing raw representation, not real user data.

## Boundaries
Browser `storage` events and compare-readback do NOT provide atomic cross-tab compare-and-swap, rollback or recovery of deleted data, and do not cover the narrow simultaneous-write interleaving. Other guest keys (profile/meal logs/chat) require separate prioritisation. This does not close #459 or hosted Firebase gate #457.

## QA gate
Do not promote until **exact QA SHA** lint/tests/build, six Chromium harnesses and Firestore Emulator are SUCCESS. Then review diff and non-force expected-SHA fast-forward into functional Draft #453 only, close temporary QA PR without main merge. No production deploy, hosted writes, paid services or TinyFish.
