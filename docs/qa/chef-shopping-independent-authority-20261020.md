# Chef IA — independent verified shopping-list read (2026-10-20)

## Baseline and problem
- Functional Draft #453 base `7c3541752bc330b4d82d8ca4aaae9854dfad2d52` (general CI #39388173699 and emulator #39388173701 SUCCESS). Production main remains `f6d6133149f585cf416cf5809d6280f6dc5486cd`.
- Previously the `SHOW_SHOPPING_LIST` answer demanded a composite snapshot of pantry, menu, shopping and progression. An invalid unrelated progression event would block a perfectly valid registered shopping list, even though the query only needs the list itself. This over-strong dependency is a resilience/UX problem, not evidence that the shopping data is wrong.

## Bounded, deterministic change
- `describeVerifiedChefShoppingList` accepts **only a complete validated shopping-list array**, rejecting duplicate IDs, malformed/unknown values and inconsistent checkbox types. Names and checked counts only; no monetary, amount, expiry, purchase or pantry claims.
- Guest selector checks session rendering, guest scope, no guest recovery or unfinished pantry/shopping journal, nonmissing shopping JSON, complete unfiltered parsed rows matching current shopping UI, and unchanged storage before returning. Does not require healthy progression/menu cache or pantry stock.
- Signed-in selector checks actual Auth UID and session UID against the Firestore server-confirmed shopping-list witness, with byte-for-byte current UI equality. Any pending write, fromCache, invalid/duplicate row, listener error or account switch revokes evidence; requires no unrelated progression server health.
- Chef modal and full tab route `SHOW_SHOPPING_LIST` through this narrowly-scoped getter before the composite read path. No extra Firebase subscriptions, API/AI calls or mutations. Other composite Chef queries retain all existing guards.
- A registered checked row **does not prove purchase**, and an empty pending list does not prove the household has no missing food.

## Verification and limits
- `tests/chefShoppingIndependentAuthority.test.ts`: pure language/validity checks, owner/scope/UI-equality, signed-in wiring.
- `qa/runtime/guest-pantry-recovery.mjs`: actual Chef IA text modal with model endpoint mocked unavailable; corrupted progression blocks progress, not shopping. Corrupt shopping in another tab then blocks only shopping, preserving its unverified source bytes and pantry.
- `qa/security/chef-read-authority-emulator.mjs`: actual Firestore SDK confirms that invalid progression no longer blocks standalone shopping while corrupt or cached shopping does.
- Must pass exact-SHA CI (tests/typecheck/build/six Chromium) and Firestore Emulator before non-force fast-forward to Draft #453; close temporary QA PR without merge. No hosted Auth/Firestore E2E, Android physical microphone, new prices/plans, Production deployments or paid browser tools.
- Guest localStorage still lacks atomic cross-tab CAS; this query performs best-effort read validation only. Original guest browser intermittency #459 and all other beta gates remain open.
