# Guest quantity-write Chromium intermittency — 2026-10-17

## Source and failure
- Initial verified base: functional Draft PR #453 `e37ccfee5c0691e88b82e379246aa125414892cc` with both jobs SUCCESS in [CI #39013511606](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/39013511606); `main=f6d6133149f585cf416cf5809d6280f6dc5486cd`, no Production changes.
- Earlier [CI #39013049546](https://github.com/alejandrorastudini-boop/balkanbite/actions/runs/39013049546) attempt 1 failed after 12-second timeout waiting for one of three recovery warning banners inside `runFailedGuestQuantityWrite()` (`qa/runtime/guest-pantry-recovery.mjs`). Its attempt 2 passed the same exact SHA without code changes. This proves intermittent browser behavior **but does not establish root cause or data safety**.
- Existing fixture seeded pantry/profile but relied on asynchronous first-render effects to persist recipes, menu and shopping caches. The quantity command chooses journal vs legacy backup based on exact persisted cache completeness. A startup race is **plausible**, not yet demonstrated.

## Narrow changes
- QA fixture seeds complete initial empty recipes/menu/shopping/progression caches and a one-time session marker; a pre-fault wait establishes the cache baseline.
- The injected Storage.setItem fault tracks exact attempts against pantry key. Test now **requires at least one attempted poisoned write**; a blocked click/no-op cannot masquerade as a successful rollback.
- A failure writes synthetic-only `guest-quantity-failure-{throw|silent}.json` with operation stage, intercepted attempts, read-only pantry/journal bytes, warning DOM presence, captured dialogs and console errors plus corresponding browser screenshot. No user data, production logs, hosted tests or paid service.
- Existing core invariants remain: failed storage writes preserve original bytes, no optimistic 550g confirmation, a visible recovery/consistency warning. No changes in persistence/business code.

## Verification and limits
- Must pass full `validate` and `runtime-harness` including `guest-pantry-recovery.mjs` at exact QA SHA, preferably repeated failed-path browser run to sample nondeterminism if available without unnecessary compute.
- Absence of recurrence does **not** close issue #459 or prove root cause. If failure recurs, inspect the emitted screenshot and JSON rather than increasing timeouts blindly.
- Safe integration only into Draft #453 via non-force expected-SHA fast-forward after full CI and diff review. Close temporary QA PR without merge. `main` and Vercel Production remain unchanged.
