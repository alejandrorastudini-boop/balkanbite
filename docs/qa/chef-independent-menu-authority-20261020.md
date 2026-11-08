# Chef IA — independent verified menu reads (2026-10-20)

## Baseline
- Draft #453 at f1886212332a93ec18020f94a17028ddc716e631. Both main CI #39392881456 and Firestore Emulator #39392881455 SUCCESS on this exact original baseline.
- main remains f6d6133149f585cf416cf5809d6280f6dc5486cd; no Production deployment authorized.

## Change
- SHOW_MENU and SHOW_TODAYS_MENU can now answer from an independently evidenced **complete meal-plan** collection, without requiring pantry, shopping, or progression authority. No inventory amounts or nutrition values are asserted from this path.
- Guest: correct guest scope, safe session/recovery state, no pending mutation journals, existing unfiltered local meal-plan cache exactly equal to visible React rows, and stable storage recheck. Missing, malformed, filtered or diverged cache refuses factual claims.
- Signed-in: correct Auth/session UID, unfiltered owner-scoped Firestore meal-plan witness with fromCache=false and no pending writes, exact UI echo. Duplicate day/doc, malformed row, stale display, offline and account switch revoke authority.
- Menu phrases keep deterministic ES/EN/BG answers, local dates, seven-day window, and explicit plan-not-consumed wording. Only independent menu questions change; shortages/progress retain composite gate.
- No LLM model calls, new Firebase listeners, writes, external subscriptions, pricing or Production changes.

## Required QA and limits
- Unit/wiring tests: tests/chefIndependentMenuAuthority.test.ts.
- Emulator: qa/security/chef-read-authority-emulator.mjs verifies independence from corrupt shopping/progression plus duplicate days and offline revocation.
- Require exact QA SHA CI validate/build/tests/six local Chromium and Firestore emulator before promoting to Draft #453. Preserve diff and non-force expected-SHA lease.
- Real hosted Auth/Firestore E2E, Android microphone, atomic guest cross-tab CAS and full Chef autonomous operation remain NOT VERIFIED.
